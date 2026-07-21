import {
  getSheetsClient,
  initializeGoogleAPI,
  getGoogleToken,
  silentRefreshGoogleToken,
} from '@/shared/utils/auth/auth';
import { useLoginTokenStore } from '@/shared/store/useLoginTokenStore';
import { buildSheetRange } from '@/shared/utils/excel/sheetRange';
import { normalizeText } from '@/shared/utils/googleSheets/oemDeviceMatching';

export interface SettingRow {
  서버: string;
  시트명: string;
  고객사: string;
  OEM: string;
  DEVICE: string;
  국가코드: string;
  해상도: string;
  Orientation: string;
  Version: string;
}

export async function fetchSettingData(
  spreadsheetId: string,
  serverLabel: string
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
      range: buildSheetRange('Setting', 'B3:J1000'),
    });

  let response;
  try {
    response = await fetchRange();
  } catch (firstErr: unknown) {
    const status = (firstErr as Record<string, unknown>)?.status as
      | number
      | undefined;

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

  const normalizedServerLabel = normalizeText(serverLabel);

  return values
    .map((row: string[]) => ({
      서버: String(row[0] ?? '').trim(),
      시트명: String(row[1] ?? '').trim(),
      고객사: String(row[2] ?? '').trim(),
      OEM: String(row[3] ?? '').trim(),
      DEVICE: String(row[4] ?? '').trim(),
      국가코드: String(row[5] ?? '').trim(),
      해상도: String(row[6] ?? '').trim(),
      Orientation: String(row[7] ?? '').trim(),
      Version: String(row[8] ?? '').trim(),
    }))
    .filter((row) => row.고객사 !== '')
    .filter(
      (row) => row.서버 === '' || normalizeText(row.서버) === normalizedServerLabel
    );
}
