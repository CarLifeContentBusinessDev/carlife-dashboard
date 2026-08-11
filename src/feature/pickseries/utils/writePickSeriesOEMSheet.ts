import type { OEMExtractionResult } from '@/feature/pickseries/utils/extractPickjoyOEMData';
import { batchUpdateSheetValues } from '@/feature/pickseries/utils/pickSeriesSheetApi';
import { buildSheetRange } from '@/shared/utils/excel/sheetRange';
import type { OEMSheetData } from '@/feature/pickseries/utils/fetchPickSeriesOEMSheet';

function colIndexToLetter(index: number): string {
  let letter = '';
  let n = index;
  do {
    letter = String.fromCharCode((n % 26) + 65) + letter;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return letter;
}

export async function writePickSeriesOEMSheet(
  tabName: string,
  sheetData: OEMSheetData,
  results: OEMExtractionResult
): Promise<void> {
  const spreadsheetId = import.meta.env
    .VITE_PICKSERIES_SPREADSHEET_ID as string;

  const data: Array<{ range: string; values: (string | number)[][] }> = [];

  for (const [date, oemResults] of Object.entries(results)) {
    const sheetRow = sheetData.dateRowMap[date];
    if (sheetRow === undefined) continue;

    for (const [oemName, itemResults] of Object.entries(oemResults)) {
      for (const [itemName, value] of Object.entries(itemResults)) {
        const colIndex = sheetData.oemItemColMap[oemName]?.[itemName];
        if (colIndex === undefined) continue;

        const range = buildSheetRange(
          tabName,
          `${colIndexToLetter(colIndex)}${sheetRow}`
        );
        data.push({ range, values: [[value]] });
      }
    }
  }

  if (data.length === 0) return;

  await batchUpdateSheetValues(spreadsheetId, data);
}
