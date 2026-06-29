import {
  getSheetsClient,
  initializeGoogleAPI,
  getGoogleToken,
  silentRefreshGoogleToken,
} from '@/utils/auth/auth';
import { useLoginTokenStore } from '@/store/useLoginTokenStore';
import { buildSheetRange } from '@/utils/excel/sheetRange';

export interface SettingRow {
  고객사: string;
  OEM: string;
  DEVICE: string;
  국가코드: string;
  해상도: string;
  Orientation: string;
}

export async function fetchSettingData(
  spreadsheetId: string
): Promise<SettingRow[]> {
  await initializeGoogleAPI();

  // 로그인 토큰이 없으면 GIS를 통해 토큰을 획득 시도
  let token: string | null = useLoginTokenStore.getState().loginToken;
  if (!token) {
    token = await getGoogleToken();
  }

  if (!token) {
    throw new Error(
      'Google 인증 토큰이 없습니다. 로그인 후 다시 시도해주세요.'
    );
  }

  gapi.client.setToken({ access_token: token });

  const sheets = getSheetsClient();

  const fetchRange = () =>
    sheets.spreadsheets.values.get({
      spreadsheetId,
      range: buildSheetRange('Setting', 'B3:G1000'),
    });

  let response;
  try {
    response = await fetchRange();
  } catch (firstErr: unknown) {
    const status = (firstErr as Record<string, unknown>)?.status as number | undefined;

    if (status === 401) {
      const newToken = await silentRefreshGoogleToken();
      if (!newToken) {
        throw new Error('Google 인증이 만료되었습니다. 다시 로그인해주세요.');
      }
      try {
        response = await fetchRange();
      } catch {
        throw new Error('Google 인증이 만료되었습니다. 다시 로그인해주세요.');
      }
    } else {
      throw firstErr;
    }
  }

  const values = response.result.values ?? [];
  if (values.length === 0) return [];

  return values
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
