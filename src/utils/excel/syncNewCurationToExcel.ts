import { toast } from 'react-toastify';
import type { usingCurationExcelProps } from '../../types/pickleProdContents';
import { getSheetsClient } from '../auth/auth';
import formatDateString from '../format/formatDateString';
import { formatPlayTime } from '../format/formatPlayTime';
import { getCurationExcelData } from './updateCuration';
import { getUsedRange } from './updateExcel';

const spreadsheetId = import.meta.env.VITE_SPREADSHEET_ID;
const sheetName = localStorage.getItem('sheetName');

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function clearExcelFromRow(startRow: number, endRow: number) {
  try {
    const sheets = getSheetsClient();
    const range = `${sheetName}!B${startRow}:W${endRow}`;

    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range,
      resource: {},
    });
    await delay(500);
  } catch (err) {
    console.error('엑셀 삭제 실패:', err);
  }
}

function excelDateTime(date?: string | number) {
  if (!date) return '';
  const d = new Date(date);
  return isNaN(d.getTime()) ? '' : formatDateString(d.toISOString());
}

async function overwriteExcelData(
  newData: usingCurationExcelProps[],
  setProgress: (progress: string) => void
) {
  const existingData = await getUsedRange();
  const totalRowsToClear = Math.max(newData.length + 3, existingData!);
  await clearExcelFromRow(4, totalRowsToClear);
  const batchSize = 1000;

  try {
    const sheets = getSheetsClient();

    for (let i = 0; i < newData.length; i += batchSize) {
      setProgress(`${Math.round((i / newData.length) * 100)}%`);
      const batch = newData.slice(i, i + batchSize);

      const values = (batch as usingCurationExcelProps[]).map((row) => [
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

      const startRow = i + 4;
      const endRow = startRow + batch.length - 1;
      const range = `${sheetName}!B${startRow}:W${endRow}`;

      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range,
        valueInputOption: 'RAW',
        resource: { values },
      });
    }

    toast.success('엑셀 동기화에 성공했습니다!');
  } catch (err) {
    console.error('엑셀 동기화 실패:', err);
    toast.error('엑셀 동기화에 실패했습니다.');
  }
}

async function syncNewCurationToExcel(
  newData: usingCurationExcelProps[],
  token: string,
  setProgress: (progress: string) => void
) {
  const excelData = await getCurationExcelData(token, spreadsheetId);

  const excelKeys = new Set(
    excelData.map((item) => `${item.curationCreatedAt}`)
  );

  const filteredNew = newData.filter(
    (item) => !excelKeys.has(`${item.curationCreatedAt}`)
  );

  const updatedData = [...filteredNew, ...excelData];

  await overwriteExcelData(updatedData, setProgress);
}

export default syncNewCurationToExcel;
