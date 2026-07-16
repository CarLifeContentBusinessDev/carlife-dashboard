import type { WeeklyExtractionResult } from '@/feature/pickseries/utils/extractPickjoyWeeklyData';
import { batchUpdateSheetValues } from '@/feature/pickseries/utils/pickSeriesSheetApi';
import { buildSheetRange } from '@/shared/utils/excel/sheetRange';
import type { WeeklySheetData } from '@/feature/pickseries/utils/fetchPickSeriesWeeklySheet';

function colIndexToLetter(index: number): string {
  let letter = '';
  let n = index;
  do {
    letter = String.fromCharCode((n % 26) + 65) + letter;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return letter;
}

export async function writePickSeriesWeeklySheet(
  tabName: string,
  sheetData: WeeklySheetData,
  results: WeeklyExtractionResult
): Promise<void> {
  const spreadsheetId = import.meta.env
    .VITE_PICKSERIES_SPREADSHEET_ID as string;

  const data: Array<{ range: string; values: (string | number)[][] }> = [];

  for (const [date, itemValues] of Object.entries(results)) {
    const colIndex = sheetData.dateColMap[date];
    if (colIndex === undefined) continue;
    const colLetter = colIndexToLetter(colIndex);

    for (const [itemName, value] of Object.entries(itemValues)) {
      const rowNum = sheetData.itemRowMap[itemName];
      if (rowNum === undefined) continue;
      if (value === '') continue;

      data.push({
        range: buildSheetRange(tabName, `${colLetter}${rowNum}`),
        values: [[value]],
      });
    }
  }

  if (data.length === 0) return;

  await batchUpdateSheetValues(spreadsheetId, data);
}
