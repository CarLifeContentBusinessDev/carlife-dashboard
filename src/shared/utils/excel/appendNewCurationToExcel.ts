import { toast } from 'react-toastify';
import {
  appendSheetValues,
  getSheetValues,
} from '@/feature/pickle-prod/utils/pickleProdSheetApi';
import type { usingCurationExcelProps } from '@/shared/types/pickleProdContents';
import formatDateString from '@/shared/utils/format/formatDateString';
import { formatPlayTime } from '@/shared/utils/format/formatPlayTime';

const STARTROW = 4;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function excelDateTime(date?: string | number) {
  if (!date) return '';
  const d = new Date(date);
  return isNaN(d.getTime()) ? '' : formatDateString(d.toISOString());
}

export async function appendNewCurationToExcel(
  newData: usingCurationExcelProps[],
  setProgress: (progress: string) => void,
  setLoading: (loading: boolean) => void,
  sheetName: string,
  spreadsheetId: string = import.meta.env.VITE_SPREADSHEET_ID
) {
  if (newData.length === 0) {
    toast.info('추가할 데이터가 없습니다.');
    return;
  }

  try {
    setLoading(true);

    const sortedData = [...newData].sort((a, b) => {
      const createdA = new Date(a.curationCreatedAt).getTime();
      const createdB = new Date(b.curationCreatedAt).getTime();
      if (createdB !== createdA) return createdB - createdA;
      const dispStartA = new Date(a.dispStartDtime).getTime();
      const dispStartB = new Date(b.dispStartDtime).getTime();
      return dispStartB - dispStartA;
    });

    const existingData = await getSheetValues(
      spreadsheetId,
      `${sheetName}!B${STARTROW}:W`
    );

    const existingRows = existingData.length;
    let nextRow = Math.max(existingRows + STARTROW, STARTROW);

    const existingTitles = new Set(
      existingData.map((row) => row[0]?.toString()).filter(Boolean)
    );
    const filteredData = sortedData.filter(
      (item) => !existingTitles.has(item.thumbnailTitle ?? '')
    );

    if (filteredData.length === 0) {
      setLoading(false);
      toast.info('추가할 새로운 데이터가 없습니다.');
      return;
    }

    const batchSize = 1000;
    const batches = Math.ceil(filteredData.length / batchSize);

    for (let batchIdx = 0; batchIdx < batches; batchIdx++) {
      const batchStart = batchIdx * batchSize;
      const batchEnd = Math.min(
        (batchIdx + 1) * batchSize,
        filteredData.length
      );
      const batchData = filteredData.slice(batchStart, batchEnd);

      setProgress(
        `데이터 추가 중... (${batchIdx + 1}/${batches} 배치, ${Math.round((batchEnd / filteredData.length) * 100)}%)`
      );

      const values = batchData.map((row) => [
        row.thumbnailTitle,
        row.curationType,
        row.curationName,
        row.curationDesc,
        row.activeState,
        row.exhibitionState,
        row.field,
        row.section,
        excelDateTime(row.dispStartDtime),
        excelDateTime(row.dispEndDtime),
        excelDateTime(row.curationCreatedAt),
        row.channelId,
        row.episodeId,
        row.usageYn,
        row.channelName,
        row.episodeName,
        excelDateTime(row.dispDtime),
        excelDateTime(row.createdAt),
        formatPlayTime(row.playTime ?? 0),
        row.likeCnt,
        row.listenCnt,
        row.uploader,
      ]);

      await appendSheetValues(spreadsheetId, `${sheetName}!B${nextRow}`, values);

      nextRow += batchData.length;
      await delay(100);
    }

    setProgress('');
    setLoading(false);
    toast.success(`${filteredData.length}개의 데이터가 추가되었습니다!`);
  } catch (err: unknown) {
    setLoading(false);
    setProgress('');
    toast.error('데이터 추가에 실패했습니다');
    throw err;
  }
}
