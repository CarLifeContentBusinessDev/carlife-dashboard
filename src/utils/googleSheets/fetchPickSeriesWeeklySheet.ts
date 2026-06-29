import {
  getSheetsClient,
  initializeGoogleAPI,
  silentRefreshGoogleToken,
} from '@/utils/auth/auth';
import { useLoginTokenStore } from '@/store/useLoginTokenStore';
import { buildSheetRange } from '@/utils/excel/sheetRange';

export interface WeeklySheetData {
  dates: string[];
  items: string[];
  existingData: Record<string, Set<string>>;
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
  await initializeGoogleAPI();

  const token = useLoginTokenStore.getState().loginToken;
  if (!token) throw new Error('Google 인증 토큰이 없습니다.');

  gapi.client.setToken({ access_token: token });

  const sheets = getSheetsClient();
  const spreadsheetId = import.meta.env
    .VITE_PICKSERIES_SPREADSHEET_ID as string;

  if (!spreadsheetId) {
    throw new Error('VITE_PICKSERIES_SPREADSHEET_ID 환경변수가 설정되지 않았습니다.');
  }

  const range = buildSheetRange(tabName, 'A4:AJ200');
  console.log('[WeeklySheet] fetch 시작:', { tabName, spreadsheetId, range });

  const callAPI = () => sheets.spreadsheets.values.get({ spreadsheetId, range });

  let response: Awaited<ReturnType<typeof sheets.spreadsheets.values.get>>;
  try {
    response = await callAPI();
  } catch (firstErr: unknown) {
    const gapiErr = firstErr as Record<string, unknown>;
    const status = gapiErr?.status as number | undefined;

    if (status === 401) {
      const newToken = await silentRefreshGoogleToken();
      if (!newToken) {
        throw new Error('Google 인증이 만료되었습니다. 다시 로그인해주세요.');
      }
      try {
        response = await callAPI();
      } catch {
        throw new Error('Google 인증이 만료되었습니다. 다시 로그인해주세요.');
      }
    } else {
      const errObj = (gapiErr?.result as Record<string, unknown>)?.error;
      const msg = errObj ? JSON.stringify(errObj) : (gapiErr?.message as string) ?? String(firstErr);
      console.error('[WeeklySheet] API 오류:', gapiErr);
      throw new Error(String(msg));
    }
  }

  const rawValues = (response.result.values ?? []) as unknown[][];
  console.log('[WeeklySheet] 응답 rows:', rawValues.length, '첫 행:', rawValues[0]);

  const values: string[][] = rawValues.map((row) =>
    (row as unknown[]).map((cell) => String(cell ?? ''))
  );

  if (values.length === 0) {
    console.warn('[WeeklySheet] 반환된 데이터 없음 (빈 range)');
    return { dates: [], items: [], existingData: {} };
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
  for (const { date, colIndex } of dateColumns) {
    existingData[date] = new Set<string>();
    for (let j = 0; j < itemRowIndices.length; j++) {
      const value = values[itemRowIndices[j]]?.[colIndex] ?? '';
      if (value.trim()) {
        existingData[date].add(items[j]);
      }
    }
  }

  return { dates: dateColumns.map((d) => d.date), items, existingData };
}
