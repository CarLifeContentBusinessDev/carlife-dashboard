import { toast } from 'react-toastify';
import type {
  usingChannelProps,
  usingDataProps,
} from '@/shared/types/pickleProdContents';
import { getSheetsClient } from '@/shared/utils/auth/auth';
import formatDateString from '@/shared/utils/format/formatDateString';
import { formatPlayTime } from '@/shared/utils/format/formatPlayTime';
import { getAudioDuration } from '@/shared/utils/format/getAudioDuration';
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
  if (category === 'episode') lastLine = 'N';

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

  // playTime === 0인 에피소드는 오디오 파일 기준으로 재생 시간 보정
  const resolvedPlayTimes = new Map<number, number>();
  if (category === 'episode') {
    const zeroPlayTimeEps = (newData as usingDataProps[]).filter(
      (ep) => ep.playTime === 0 && ep.audioUrl
    );
    await Promise.all(
      zeroPlayTimeEps.map(async (ep) => {
        const duration = await getAudioDuration(ep.audioUrl);
        resolvedPlayTimes.set(ep.episodeId, duration);
      })
    );
  }

  try {
    setAllLoading(true);
    const sheets = getSheetsClient();

    // 시트 ID 조회 (rowCount/필터 조정에 필요)
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const sheetMeta = meta.result.sheets?.find(
      (s) => s.properties?.title === sheetName
    );
    const sheetId = sheetMeta?.properties?.sheetId;

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
            formatPlayTime(
              resolvedPlayTimes.get(row.episodeId) ?? row.playTime
            ),
            row.likeCnt,
            row.listenCnt,
            row.thumbnailUrl,
            row.audioUrl,
            row.channelId,
            '',
          ];
        });
        const startRow = i + STARTROW;
        const endRow = startRow + batch.length - 1;
        range = `${sheetName}!B${startRow}:N${endRow}`;
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
        range = `${sheetName}!B${startRow}:N${endRow}`;
      }

      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range,
        valueInputOption: 'RAW',
        resource: { values },
      });
    }

    // rowCount를 데이터 수에 맞게 정확히 조정하고 필터 범위 갱신
    if (sheetId !== undefined && sheetId !== null) {
      setProgress('시트 행 수 및 필터 조정 중...');
      const exactRowCount = STARTROW - 1 + newData.length + 1;
      const lastColIndex = category === 'episode' ? 13 : 14;
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        resource: {
          requests: [
            {
              updateSheetProperties: {
                properties: {
                  sheetId,
                  gridProperties: { rowCount: exactRowCount },
                },
                fields: 'gridProperties.rowCount',
              },
            },
            {
              setBasicFilter: {
                filter: {
                  range: {
                    sheetId,
                    startRowIndex: STARTROW - 2,
                    endRowIndex: exactRowCount - 1,
                    startColumnIndex: 1,
                    endColumnIndex: lastColIndex,
                  },
                },
              },
            },
          ],
        },
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

  const getItemId = (item: usingDataProps | usingChannelProps) =>
    'episodeId' in item ? item.episodeId : item.channelId;

  const excelIds = new Set(excelData.map(getItemId));
  const filteredNew = newData.filter((item) => !excelIds.has(getItemId(item)));

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
