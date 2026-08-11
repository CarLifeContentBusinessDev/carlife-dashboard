import { getSheetValues } from '@/feature/picknow/utils/picknowSheetApi';
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
  const fetchRange = () =>
    getSheetValues(spreadsheetId, buildSheetRange('Setting', 'B3:J1000'));

  let response;
  try {
    response = await fetchRange();
  } catch (firstErr: unknown) {
    const status = (firstErr as Record<string, unknown>)?.status as
      number | undefined;

    if (status === 401) {
      try {
        response = await fetchRange();
      } catch {
        throw new Error('Google 인증이 만료되었습니다. 다시 로그인해주세요.');
      }
    } else {
      throw firstErr;
    }
  }

  const values = response ?? [];
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
      (row) =>
        row.서버 === '' || normalizeText(row.서버) === normalizedServerLabel
    );
}
