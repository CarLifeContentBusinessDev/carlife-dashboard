import { getSheetsClient } from '@/utils/auth/auth';
import { buildSheetRange } from '@/utils/excel/sheetRange';
import type { OEMSheetData } from '@/utils/googleSheets/fetchPickSeriesOEMSheet';
import type { OEMExtractionResult } from '@/utils/pickseries/extractPickjoyOEMData';

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
  const spreadsheetId = import.meta.env.VITE_PICKSERIES_SPREADSHEET_ID as string;
  const sheets = getSheetsClient();

  const data: Array<{ range: string; values: (string | number)[][] }> = [];

  for (const [date, oemResults] of Object.entries(results)) {
    const sheetRow = sheetData.dateRowMap[date];
    if (sheetRow === undefined) continue;

    for (const [oemName, itemResults] of Object.entries(oemResults)) {
      for (const [itemName, value] of Object.entries(itemResults)) {
        const colIndex = sheetData.oemItemColMap[oemName]?.[itemName];
        if (colIndex === undefined) continue;

        const range = buildSheetRange(tabName, `${colIndexToLetter(colIndex)}${sheetRow}`);
        data.push({ range, values: [[value]] });
      }
    }
  }

  if (data.length === 0) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (sheets.spreadsheets.values as any).batchUpdate({
    spreadsheetId,
    resource: { valueInputOption: 'USER_ENTERED', data },
  });
}
