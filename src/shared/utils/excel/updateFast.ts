import { toast } from 'react-toastify';
import {
  batchUpdateSpreadsheet,
  clearSheetValues,
  getSheetValues,
  getSpreadsheetMeta,
  updateSheetValues,
} from '@/feature/pickle-prod/utils/pickleProdSheetApi';
import type { ProdFastRow } from '@/shared/types/pickleProdContents';
import formatDateString from '@/shared/utils/format/formatDateString';
import { formatPlayTime } from '@/shared/utils/format/formatPlayTime';
import { mapFastHlsStatus } from '@/shared/utils/format/statusMapper';
import { chunkValuesBySize } from './chunkValuesBySize';
import { getUsedRange } from './updateExcel';

const STARTROW = 4;
const LAST_COLUMN = 'P';
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const toDateOnly = (value?: string) => formatDateString(value).slice(0, 10);

const toDispPeriod = (start?: string, end?: string) => {
  const s = toDateOnly(start);
  const e = toDateOnly(end);
  if (!s && !e) return '';
  return `${s} ~ ${e}`;
};

export function fastRowToSheetValues(row: ProdFastRow): (string | number)[] {
  return [
    row.fastId,
    row.usageYn,
    row.fastName,
    row.includedChannelNames,
    mapFastHlsStatus(row.hlsStatus),
    row.episodeCount,
    formatDateString(row.createdAt),
    toDispPeriod(row.dispStartDtime, row.dispEndDtime),
    formatDateString(row.generationStartedAt),
    formatDateString(row.generationEndedAt),
    row.totalGenerationSeconds > 0
      ? formatPlayTime(row.totalGenerationSeconds)
      : '',
    row.touchCount, // 터치 수
    row.playRequestCount,
    row.streamUrl,
    '', // thumbnail_url (미연동)
  ];
}

export async function getExistingFastIds(
  spreadsheetId: string,
  sheetName?: string
): Promise<Set<number>> {
  const targetSheet =
    sheetName || localStorage.getItem('sheetName') || 'Sheet1';

  const totalRows = await getUsedRange(targetSheet, spreadsheetId);
  if (totalRows === null || totalRows < STARTROW) return new Set();

  const batchSize = 1000;
  const totalBatches = Math.ceil((totalRows - STARTROW + 1) / batchSize);
  const ids = new Set<number>();

  for (let i = 0; i < totalBatches; i++) {
    const startRow = STARTROW + i * batchSize;
    const endRow = Math.min(startRow + batchSize - 1, totalRows);
    const range = `${targetSheet}!B${startRow}:B${endRow}`;

    try {
      const values = await getSheetValues(spreadsheetId, range);
      values.forEach((row) => {
        const id = Number(row[0]);
        if (Number.isFinite(id) && id > 0) ids.add(id);
      });
    } catch (err) {
      console.error('FAST 시트 조회 실패:', err);
    }
  }

  return ids;
}

export async function overwriteFastExcelData(
  data: ProdFastRow[],
  sheetName?: string,
  spreadsheetId?: string
): Promise<void> {
  try {
    const targetSpreadsheetId =
      spreadsheetId || import.meta.env.VITE_SPREADSHEET_ID;
    const targetSheet =
      sheetName || localStorage.getItem('sheetName') || 'Sheet1';

    const values = data.map(fastRowToSheetValues);

    const MAX_ROWS = 400000;
    const clearRange = `${targetSheet}!B${STARTROW}:${LAST_COLUMN}${MAX_ROWS}`;

    await clearSheetValues(targetSpreadsheetId, clearRange);

    // Vercel 요청 본문 4.5MB 한도를 넘지 않도록 크기 기준 청킹
    const chunks = chunkValuesBySize(values);
    for (const chunk of chunks) {
      const chunkStartRow = STARTROW + chunk.offset;
      await updateSheetValues(
        targetSpreadsheetId,
        `${targetSheet}!B${chunkStartRow}`,
        chunk.rows
      );
      if (chunks.length > 1) await delay(300);
    }

    const meta = await getSpreadsheetMeta(targetSpreadsheetId);
    const sheetMeta = meta.sheets?.find(
      (s) => s.properties?.title === targetSheet
    );
    const sheetId = sheetMeta?.properties?.sheetId;

    if (sheetId !== undefined && sheetId !== null) {
      const exactRowCount = STARTROW - 1 + values.length + 1;
      await batchUpdateSpreadsheet(targetSpreadsheetId, [
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
                endColumnIndex: 16,
              },
            },
          },
        },
      ]);
    }

    toast.success('FAST 데이터 덮어쓰기 완료!');
  } catch (err) {
    console.error('FAST 데이터 덮어쓰기 실패:', err);
    toast.error('FAST 데이터 덮어쓰기 실패!');
    throw err;
  }
}
