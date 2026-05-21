import { toast } from 'react-toastify';
import type { usingCurationExcelProps } from '@/types/pickleProdContents';
import { getSheetsClient } from '@/utils/auth/auth';
import formatDateString from '@/utils/format/formatDateString';
import { formatPlayTime } from '@/utils/format/formatPlayTime';
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
    const range = `${sheetName}!B${startRow}:X${endRow}`;

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

const STARTROW = 4;

async function overwriteExcelData(
  newData: usingCurationExcelProps[],
  setProgress: (progress: string) => void
) {
  const existingData = await getUsedRange();
  const totalRowsToClear = Math.max(newData.length + 3, existingData!);
  await clearExcelFromRow(STARTROW, totalRowsToClear);
  const batchSize = 1000;

  try {
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
        '',
      ]);

      const startRow = i + STARTROW;
      const endRow = startRow + batch.length - 1;
      const range = `${sheetName}!B${startRow}:X${endRow}`;

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
                    endColumnIndex: 23,
                  },
                },
              },
            },
          ],
        },
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
