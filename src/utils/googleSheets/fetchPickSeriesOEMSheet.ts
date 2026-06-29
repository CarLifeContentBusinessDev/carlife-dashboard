import {
  getSheetsClient,
  initializeGoogleAPI,
  silentRefreshGoogleToken,
} from '@/utils/auth/auth';
import { useLoginTokenStore } from '@/store/useLoginTokenStore';
import { buildSheetRange } from '@/utils/excel/sheetRange';

export interface OEMGroup {
  name: string;
  items: string[];
}

export interface OEMSheetData {
  dates: string[];
  oems: OEMGroup[];
  allItems: string[];
  existingData: Record<string, Record<string, Set<string>>>;
}

function isDateLike(value: string): boolean {
  const trimmed = value.trim();
  // "YYYY. M. D" 등 연도 포함 형식
  if (/\d{4}\D+\d{1,2}\D+\d{1,2}/.test(trimmed)) return true;
  // "M. D" 형식 (Google Sheets 날짜 셀이 월.일만 표시할 때)
  return /^\d{1,2}\.\s*\d{1,2}$/.test(trimmed);
}

function normalizeDate(raw: string): string {
  const trimmed = raw.trim();
  // "M. D" 형식 → 현재 연도 보충
  const short = trimmed.match(/^(\d{1,2})\.\s*(\d{1,2})$/);
  if (short) {
    const year = new Date().getFullYear();
    return `${year}.${short[1].padStart(2, '0')}.${short[2].padStart(2, '0')}`;
  }
  // "YYYY. M. D" 등
  const m = trimmed.match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
  if (!m) return trimmed;
  return `${m[1]}.${m[2].padStart(2, '0')}.${m[3].padStart(2, '0')}`;
}

export async function fetchPickSeriesOEMSheet(
  tabName: string,
  excludedItems: string[] = []
): Promise<OEMSheetData> {
  await initializeGoogleAPI();

  const token = useLoginTokenStore.getState().loginToken;
  if (!token) throw new Error('Google 인증 토큰이 없습니다.');

  gapi.client.setToken({ access_token: token });

  const sheets = getSheetsClient();
  const spreadsheetId = import.meta.env
    .VITE_PICKSERIES_SPREADSHEET_ID as string;

  if (!spreadsheetId) {
    throw new Error(
      'VITE_PICKSERIES_SPREADSHEET_ID 환경변수가 설정되지 않았습니다.'
    );
  }

  const range = buildSheetRange(tabName, 'A4:AJ200');
  console.log('[OEMSheet] fetch 시작:', { tabName, spreadsheetId, range });

  const callAPI = () =>
    sheets.spreadsheets.values.get({ spreadsheetId, range });

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
      const msg =
        errObj
          ? JSON.stringify(errObj)
          : ((gapiErr?.message as string) ?? String(firstErr));
      console.error('[OEMSheet] API 오류:', gapiErr);
      throw new Error(String(msg));
    }
  }

  const rawValues = (response.result.values ?? []) as unknown[][];
  console.log('[OEMSheet] 응답 rows:', rawValues.length);

  const values: string[][] = rawValues.map((row) =>
    (row as unknown[]).map((cell) => String(cell ?? ''))
  );

  if (values.length < 2) {
    return { dates: [], oems: [], allItems: [], existingData: {} };
  }

  // Row 0 = 시트 4행: D열(index 3)부터 OEM명
  const oemRow = values[0];
  // Row 1 = 시트 5행: 항목명
  const itemRow = values[1] ?? [];

  console.log('[OEMSheet] 4행 전체:', oemRow);
  console.log('[OEMSheet] C열 샘플(6~10행):', values.slice(2, 7).map((row, i) => `row${i + 6}: "${row[2] ?? ''}"`));

  const excludedSet = new Set(excludedItems);

  // 비어있지 않은 셀을 OEM 시작점으로 탐지 (index 3 = D열부터)
  const oemStarts: Array<{ name: string; colIndex: number }> = [];
  for (let i = 3; i < oemRow.length; i++) {
    const cell = oemRow[i]?.trim();
    if (cell) {
      oemStarts.push({ name: cell, colIndex: i });
    }
  }
  console.log('[OEMSheet] 감지된 OEM:', oemStarts);

  // OEM 그룹 빌드: 다음 OEM 시작 전까지의 열이 해당 OEM의 항목
  const oems: OEMGroup[] = oemStarts.map(({ name, colIndex }, idx) => {
    const nextColIndex = oemStarts[idx + 1]?.colIndex ?? itemRow.length;
    const items: string[] = [];
    for (let c = colIndex; c < nextColIndex; c++) {
      const item = itemRow[c]?.trim();
      if (item && !excludedSet.has(item)) {
        items.push(item);
      }
    }
    return { name, items };
  });

  const allItems = oems[0]?.items ?? [];
  console.log('[OEMSheet] allItems:', allItems);

  // 날짜: C열(index 2), row index 2부터 (시트 6행~)
  const dateRows: Array<{ date: string; rowIndex: number }> = [];
  for (let i = 2; i < values.length; i++) {
    const cell = values[i]?.[2] ?? '';
    if (cell.trim() && isDateLike(cell)) {
      dateRows.push({ date: normalizeDate(cell), rowIndex: i });
    }
  }
  console.log('[OEMSheet] 감지된 날짜:', dateRows.map((d) => d.date));

  // existingData: 날짜 → OEM명 → Set<항목명>
  const existingData: Record<string, Record<string, Set<string>>> = {};
  for (const { date, rowIndex } of dateRows) {
    existingData[date] = {};
    for (let oemIdx = 0; oemIdx < oemStarts.length; oemIdx++) {
      const { name: oemName, colIndex } = oemStarts[oemIdx];
      const nextColIndex = oemStarts[oemIdx + 1]?.colIndex ?? itemRow.length;
      existingData[date][oemName] = new Set<string>();
      for (let c = colIndex; c < nextColIndex; c++) {
        const item = itemRow[c]?.trim();
        if (item && !excludedSet.has(item)) {
          const value = values[rowIndex]?.[c] ?? '';
          if (value.trim()) {
            existingData[date][oemName].add(item);
          }
        }
      }
    }
  }

  return {
    dates: dateRows.map((d) => d.date),
    oems,
    allItems,
    existingData,
  };
}
