import { toast } from 'react-toastify';
import type {
  usingChannelProps,
  usingDataProps,
} from '../../types/pickleProdContents';
import { getSheetsClient } from '../auth/auth';
import formatDateString from '../format/formatDateString';
import { formatPlayTime } from '../format/formatPlayTime';
import { getExcelData, getUsedRange } from './updateExcel';

const spreadsheetId = import.meta.env.VITE_SPREADSHEET_ID;
const STARTROW = 4;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function clearExcelFromRow(
  startRow: number,
  endRow: number,
  category: 'episode' | 'channel',
  sheetName: string
) {
  let lastLine = 'M';
  if (category === 'episode') lastLine = 'M';

  try {
    const sheets = getSheetsClient();
    const range = `${sheetName}!B${startRow}:${lastLine}${endRow}`;

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
  newData: usingChannelProps[],
  setProgress: (progress: string) => void,
  category: 'channel',
  setAllLoading: (loading: boolean) => void,
  sheetName: string
): Promise<void>;
async function overwriteExcelData(
  newData: usingDataProps[],
  setProgress: (progress: string) => void,
  category: 'episode',
  setAllLoading: (loading: boolean) => void,
  sheetName: string
): Promise<void>;
async function overwriteExcelData(
  newData: (usingDataProps | usingChannelProps)[],
  setProgress: (progress: string) => void,
  category: 'episode' | 'channel',
  setAllLoading: (loading: boolean) => void,
  sheetName: string
): Promise<void>;

async function overwriteExcelData(
  newData: (usingDataProps | usingChannelProps)[],
  setProgress: (progress: string) => void,
  category: 'episode' | 'channel',
  setAllLoading: (loading: boolean) => void,
  sheetName: string
) {
  const existingData = await getUsedRange(sheetName);
  const totalRowsToClear = Math.max(newData.length + 2, existingData!);
  await clearExcelFromRow(STARTROW, totalRowsToClear, category, sheetName);
  const batchSize = 10000;

  try {
    setAllLoading(true);
    const sheets = getSheetsClient();

    for (let i = 0; i < newData.length; i += batchSize) {
      setProgress(`${Math.round((i / newData.length) * 100)}%`);
      const batch = newData.slice(i, i + batchSize);
      let values;
      let range;

      if (category === 'episode') {
        values = (batch as usingDataProps[]).map((row) => {
          const createdAtStr = excelDateTime(row.createdAt);
          const dispDtimeStr = excelDateTime(row.dispDtime);

          return [
            row.episodeId,
            row.usageYn,
            row.channelName,
            row.episodeName,
            dispDtimeStr,
            createdAtStr,
            formatPlayTime(row.playTime),
            row.likeCnt,
            row.listenCnt,
            row.thumbnailUrl,
            row.audioUrl,
            row.channelId,
          ];
        });
        const startRow = i + STARTROW;
        const endRow = startRow + batch.length - 1;
        range = `${sheetName}!B${startRow}:M${endRow}`;
      } else {
        values = (batch as usingChannelProps[]).map((row) => {
          const createdAtStr = excelDateTime(row.createdAt);
          const dispDtimeStr = excelDateTime(row.dispDtime);

          return [
            row.channelId,
            row.usageYn,
            row.channelName,
            row.vendorName,
            row.categoryName,
            dispDtimeStr,
            row.channelTypeName,
            row.likeCnt,
            row.listenCnt,
            createdAtStr,
            row.interfaceUrl,
            row.thumbnailUrl,
          ];
        });
        const startRow = i + STARTROW;
        const endRow = startRow + batch.length - 1;
        range = `${sheetName}!B${startRow}:M${endRow}`;
      }

      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range,
        valueInputOption: 'RAW',
        resource: { values },
      });
    }

    setAllLoading(false);
    toast.success('엑셀 동기화에 성공했습니다!');
  } catch (err) {
    console.error('엑셀 동기화 실패:', err);
    toast.error('엑셀 동기화에 실패했습니다.');
  }
}

export async function syncNewDataToExcel(
  newData: usingChannelProps[],
  token: string,
  setProgress: (progress: string) => void,
  category: 'channel',
  setAllLoading: (loading: boolean) => void
): Promise<void>;
export async function syncNewDataToExcel(
  newData: usingDataProps[],
  token: string,
  setProgress: (progress: string) => void,
  category: 'episode',
  setAllLoading: (loading: boolean) => void
): Promise<void>;

export async function syncNewDataToExcel(
  newData: (usingDataProps | usingChannelProps)[],
  token: string,
  setProgress: (progress: string) => void,
  category: 'episode' | 'channel',
  setAllLoading: (loading: boolean) => void
) {
  const sheetName = localStorage.getItem('sheetName') || '';
  const excelData = await getExcelData(token, category, sheetName);

  const excelIds = new Set(
    excelData.map((item) => (item as any).episodeId ?? (item as any).channelId)
  );
  const filteredNew = newData.filter(
    (item) => !excelIds.has((item as any).episodeId ?? (item as any).channelId)
  );

  const updatedData = [...filteredNew, ...excelData];

  await overwriteExcelData(
    updatedData,
    setProgress,
    category,
    setAllLoading,
    sheetName
  );
}

export async function syncNewDuplicateDataToExcel(
  duplicateNewEpi: usingDataProps[],
  token: string,
  setProgress: (progress: string) => void,
  category: 'episode',
  setAllLoading: (loading: boolean) => void,
  sheetName: string
) {
  const excelData = await getExcelData(token, category, sheetName);
  const updatedData = [...duplicateNewEpi, ...excelData];

  await overwriteExcelData(
    updatedData,
    setProgress,
    category,
    setAllLoading,
    sheetName
  );
}
