import { toast } from 'react-toastify';
import {
  appendSheetValues,
  getSheetValues,
} from '@/feature/pickle-prod/utils/pickleProdSheetApi';
import type { usingCurationExcelProps } from '@/shared/types/pickleProdContents';
import formatDateString from '@/shared/utils/format/formatDateString';
import { formatPlayTime } from '@/shared/utils/format/formatPlayTime';
import { chunkValuesBySize } from './chunkValuesBySize';

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

    const allValues = filteredData.map((row) => [
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

    // Vercel 요청 본문 4.5MB 한도를 넘지 않도록 크기 기준 청킹
    let written = 0;
    for (const chunk of chunkValuesBySize(allValues)) {
      await appendSheetValues(
        spreadsheetId,
        `${sheetName}!B${nextRow}`,
        chunk.rows
      );

      nextRow += chunk.rows.length;
      written += chunk.rows.length;
      setProgress(
        `데이터 추가 중... (${written}/${allValues.length}, ${Math.round((written / allValues.length) * 100)}%)`
      );
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
