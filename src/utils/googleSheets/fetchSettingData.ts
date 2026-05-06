import { getSheetsClient, initializeGoogleAPI } from '../auth/auth';
import { useLoginTokenStore } from '../../store/useLoginTokenStore';
import { buildSheetRange } from '../excel/sheetRange';

export interface SettingRow {
  고객사: string;
  OEM: string;
  DEVICE: string;
  국가코드: string;
  해상도: string;
  Orientation: string;
}

export async function fetchSettingData(): Promise<SettingRow[]> {
  await initializeGoogleAPI();

  const token = useLoginTokenStore.getState().loginToken;
  gapi.client.setToken({ access_token: token });

  const sheets = getSheetsClient();
  const spreadsheetId = import.meta.env.VITE_PICKNOW_SPREADSHEET_ID as string;

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: buildSheetRange('Setting', 'B2:G1000'),
  });

  const values = response.result.values ?? [];
  if (values.length < 2) return [];

  return values
    .slice(1)
    .map((row: string[]) => ({
      고객사: String(row[0] ?? '').trim(),
      OEM: String(row[1] ?? '').trim(),
      DEVICE: String(row[2] ?? '').trim(),
      국가코드: String(row[3] ?? '').trim(),
      해상도: String(row[4] ?? '').trim(),
      Orientation: String(row[5] ?? '').trim(),
    }))
    .filter((row) => row.고객사 !== '');
}
