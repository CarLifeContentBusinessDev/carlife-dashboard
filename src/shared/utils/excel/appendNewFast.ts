import { toast } from 'react-toastify';
import {
  appendSheetValues,
  getSheetValues,
} from '@/feature/pickle-prod/utils/pickleProdSheetApi';
import type { ProdFastRow } from '@/shared/types/pickleProdContents';
import { fastRowToSheetValues } from './updateFast';

const STARTROW = 4;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function appendNewFastToExcel(
  newData: ProdFastRow[],
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

    const sortedData = [...newData].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const existingData = await getSheetValues(
      spreadsheetId,
      `${sheetName}!B${STARTROW}:P`
    );

    const existingRows = existingData.length;
    let nextRow = Math.max(existingRows + STARTROW, STARTROW);

    const existingIds = new Set(
      existingData
        .map((row) => Number(row[0]))
        .filter((id) => Number.isFinite(id) && id > 0)
    );
    const filteredData = sortedData.filter(
      (item) => !existingIds.has(item.fastId)
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

      const values = batchData.map(fastRowToSheetValues);

      await appendSheetValues(
        spreadsheetId,
        `${sheetName}!B${nextRow}`,
        values
      );

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
