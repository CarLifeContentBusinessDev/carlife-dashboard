import { toast } from 'react-toastify';
import type { usingCurationExcelProps } from '../../types/type';
import { getGoogleToken, getSheetsClient } from '../auth/auth';
import formatDateString from '../format/formatDateString';
import { formatPlayTime } from '../format/formatPlayTime';

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

    // 작업 시작 전 토큰 갱신
    await getGoogleToken();
    const sheets = getSheetsClient();

    const sortedData = [...newData].sort((a, b) => {
      const createdA = new Date(a.curationCreatedAt).getTime();
      const createdB = new Date(b.curationCreatedAt).getTime();
      if (createdB !== createdA) return createdB - createdA;
      const dispStartA = new Date(a.dispStartDtime).getTime();
      const dispStartB = new Date(b.dispStartDtime).getTime();
      return dispStartB - dispStartA;
    });

    // 기존 데이터 읽기 전 토큰 체크
    await getGoogleToken();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!B${STARTROW}:W`,
    });

    const existingData = response.result.values || [];
    const existingRows = response.result.values?.length || 0;
    let nextRow = Math.max(existingRows + STARTROW, STARTROW);

    const existingTitles = new Set(
      existingData.map((row) => row[0]?.toString()).filter(Boolean)
    );
    const filteredData = sortedData.filter(
      (item) => !existingTitles.has(item.thumbnailTitle)
    );

    if (filteredData.length === 0) {
      setLoading(false);
      toast.info('추가할 새로운 데이터가 없습니다.');
      return;
    }

    const batchSize = 1000;
    const batches = Math.ceil(filteredData.length / batchSize);

    for (let batchIdx = 0; batchIdx < batches; batchIdx++) {
      // 배치 추가 직전마다 토큰 자동 갱신
      await getGoogleToken();

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

      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${sheetName}!B${nextRow}`,
        valueInputOption: 'RAW',
        resource: { values },
      });

      nextRow += batchData.length;
      await delay(100);
    }

    setProgress('');
    setLoading(false);
    toast.success(`${filteredData.length}개의 데이터가 추가되었습니다!`);
  } catch (err: any) {
    setLoading(false);
    setProgress('');
    const errorMessage = err.result?.error?.message || '알 수 없는 오류';
    toast.error(`데이터 추가에 실패했습니다: ${errorMessage}`);
    throw err;
  }
}
