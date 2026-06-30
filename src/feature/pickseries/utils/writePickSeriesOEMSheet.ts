import type { OEMExtractionResult } from '@/feature/pickseries/utils/extractPickjoyOEMData';
import { useLoginTokenStore } from '@/shared/store/useLoginTokenStore';
import { getSheetsClient, initializeGoogleAPI } from '@/shared/utils/auth/auth';
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

  await initializeGoogleAPI();
  const token = useLoginTokenStore.getState().loginToken;
  if (!token) throw new Error('Google 인증 토큰이 없습니다.');
  gapi.client.setToken({ access_token: token });

  const sheets = getSheetsClient();

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (sheets.spreadsheets.values as any).batchUpdate({
    spreadsheetId,
    resource: { valueInputOption: 'USER_ENTERED', data },
  });
}
