import { getSheetValues } from '@/feature/pickseries/utils/pickSeriesSheetApi';
import { buildSheetRange } from '@/shared/utils/excel/sheetRange';

export interface WeeklySheetData {
  dates: string[];
  items: string[];
  existingData: Record<string, Set<string>>;
  // date → 0-based column index (A=0, B=1, C=2, D=3, ...)
  dateColMap: Record<string, number>;
  // itemName → 1-based sheet row number
  itemRowMap: Record<string, number>;
}

function isDateLike(value: string): boolean {
  return /\d{4}[\s.]+\d{1,2}[\s.]+\d{1,2}/.test(value.trim());
}

function normalizeDate(raw: string): string {
  const m = raw.trim().match(/(\d{4})[\s.]+(\d{1,2})[\s.]+(\d{1,2})/);
  if (!m) return raw.trim();
  return `${m[1]}.${m[2].padStart(2, '0')}.${m[3].padStart(2, '0')}`;
}

export async function fetchPickSeriesWeeklySheet(
  tabName: string
): Promise<WeeklySheetData> {
  const spreadsheetId = import.meta.env
    .VITE_PICKSERIES_SPREADSHEET_ID as string;

  if (!spreadsheetId) {
    throw new Error(
      'VITE_PICKSERIES_SPREADSHEET_ID 환경변수가 설정되지 않았습니다.'
    );
  }

  const range = buildSheetRange(tabName, 'A4:AJ200');
  console.log('[WeeklySheet] fetch 시작:', { tabName, spreadsheetId, range });

  const rawValues = await getSheetValues(spreadsheetId, range);
  console.log(
    '[WeeklySheet] 응답 rows:',
    rawValues.length,
    '첫 행:',
    rawValues[0]
  );

  const values: string[][] = rawValues.map((row) =>
    (row as unknown[]).map((cell) => String(cell ?? ''))
  );

  if (values.length === 0) {
    console.warn('[WeeklySheet] 반환된 데이터 없음 (빈 range)');
    return {
      dates: [],
      items: [],
      existingData: {},
      dateColMap: {},
      itemRowMap: {},
    };
  }

  const headerRow = values[0];
  console.log('[WeeklySheet] 4행 (날짜 헤더):', headerRow);

  const dateColumns: Array<{ date: string; colIndex: number }> = [];
  headerRow.forEach((cell, idx) => {
    if (cell && isDateLike(cell)) {
      dateColumns.push({ date: normalizeDate(cell), colIndex: idx });
    }
  });
  console.log('[WeeklySheet] 감지된 날짜 컬럼:', dateColumns);

  const items: string[] = [];
  const itemRowIndices: number[] = [];
  for (let i = 1; i < values.length; i++) {
    const cell = values[i]?.[2] ?? '';
    if (cell.trim()) {
      items.push(cell.trim());
      itemRowIndices.push(i);
    }
  }
  console.log('[WeeklySheet] 감지된 항목 (C열):', items);

  const existingData: Record<string, Set<string>> = {};
  const dateColMap: Record<string, number> = {};
  for (const { date, colIndex } of dateColumns) {
    dateColMap[date] = colIndex;
    existingData[date] = new Set<string>();
    for (let j = 0; j < itemRowIndices.length; j++) {
      const value = values[itemRowIndices[j]]?.[colIndex] ?? '';
      if (value.trim()) {
        existingData[date].add(items[j]);
      }
    }
  }

  // values[0] = 시트 4행, values[i] = 시트 (4+i)행
  const itemRowMap: Record<string, number> = {};
  for (let j = 0; j < items.length; j++) {
    itemRowMap[items[j]] = 4 + itemRowIndices[j];
  }

  return {
    dates: dateColumns.map((d) => d.date),
    items,
    existingData,
    dateColMap,
    itemRowMap,
  };
}
