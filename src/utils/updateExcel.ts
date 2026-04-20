import { toast } from 'react-toastify';
import type { usingChannelProps, usingDataProps } from '../types/type';
import { getGoogleToken, getSheetsClient } from './auth';
import formatDateString from './formatDateString';
import { formatPlayTime, parsePlayTime } from './formatPlayTime';
import { buildSheetRange } from './sheetRange';

const MAX_ROWS = 300000;
const STARTROW = 4;

const resolveSheetName = (
  category: 'episode' | 'channel',
  sheetName?: string
) => {
  if (sheetName) return sheetName;

  const isStaging = window.location.pathname.startsWith('/stg');
  const storageKey = isStaging
    ? `sheetName:${category}:stg`
    : `sheetName:${category}:prod`;

  return (
    localStorage.getItem(storageKey) ||
    localStorage.getItem('sheetName') ||
    'Sheet1'
  );
};

// Google Sheets에서 마지막 데이터 행 조회
export async function getUsedRange(
  sheetName?: string,
  spreadsheetId?: string
): Promise<number | null> {
  try {
    const token = await getGoogleToken();
    if (!token) throw new Error('인증 토큰이 없습니다');

    const targetSheet =
      sheetName || localStorage.getItem('sheetName') || '시트를 선택해주세요.';
    const sheets = getSheetsClient();

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: spreadsheetId || import.meta.env.VITE_SPREADSHEET_ID,
      range: buildSheetRange(targetSheet, `D1:D${MAX_ROWS}`),
    });

    const values = response.result.values;
    if (!values || values.length === 0) return STARTROW;

    let lastDataRow = 0;
    for (let i = values.length - 1; i >= 0; i--) {
      if (values[i] && values[i][0] !== null && values[i][0] !== '') {
        lastDataRow = i + 1;
        break;
      }
    }

    return Math.max(lastDataRow, STARTROW);
  } catch (err) {
    console.error('마지막 행 조회 실패:', err);
    return null;
  }
}

// Google Sheets에서 데이터 읽기
export async function getExcelData(
  token: string,
  category: 'channel',
  sheetName?: string,
  spreadSheetId?: string
): Promise<usingChannelProps[]>;
export async function getExcelData(
  token: string,
  category: 'episode',
  sheetName?: string,
  spreadSheetId?: string
): Promise<usingDataProps[]>;
export async function getExcelData(
  token: string,
  category: 'episode' | 'channel',
  sheetName?: string,
  spreadSheetId?: string
): Promise<(usingDataProps | usingChannelProps)[]>;

export async function getExcelData(
  _token: string,
  category: 'episode' | 'channel' = 'episode',
  sheetName?: string,
  spreadSheetId?: string
): Promise<(usingDataProps | usingChannelProps)[]> {
  try {
    const targetSheet = resolveSheetName(category, sheetName);
    const totalRows = await getUsedRange(targetSheet, spreadSheetId);

    if (!totalRows || totalRows < STARTROW) {
      return [];
    }

    const sheets = getSheetsClient();
    const lastColumn = category === 'episode' ? 'M' : 'N';
    const range = buildSheetRange(
      targetSheet,
      `B${STARTROW}:${lastColumn}${totalRows}`
    );

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: spreadSheetId || import.meta.env.VITE_SPREADSHEET_ID,
      range,
    });

    const values = response.result.values || [];
    const validRows = filterRows(values);

    if (category === 'episode') {
      return validRows.map(
        (row) =>
          ({
            episodeId: Number(row[0] ?? 0),
            usageYn: String(row[1] ?? ''),
            channelName: String(row[2] ?? ''),
            episodeName: String(row[3] ?? ''),
            dispDtime: String(row[4] ?? ''),
            createdAt: String(row[5] ?? ''),
            playTime: parsePlayTime(row[6] ?? 0),
            likeCnt: Number(row[7] ?? 0),
            listenCnt: Number(row[8] ?? 0),
            thumbnailUrl: String(row[9] ?? ''),
            audioUrl: String(row[10] ?? ''),
            channelId: Number(row[11] ?? 0),
          }) as usingDataProps
      );
    } else {
      return validRows.map(
        (row) =>
          ({
            channelId: Number(row[0] ?? 0),
            usageYn: String(row[1] ?? ''),
            channelName: String(row[2] ?? ''),
            vendorName: String(row[3] ?? ''),
            categoryName: String(row[4] ?? ''),
            episodeCount: Number(row[5] ?? 0),
            dispDtime: String(row[6] ?? ''),
            channelTypeName: String(row[7] ?? ''),
            likeCnt: Number(row[8] ?? 0),
            listenCnt: Number(row[9] ?? 0),
            createdAt: String(row[10] ?? ''),
            interfaceUrl: String(row[11] ?? ''),
            thumbnailUrl: String(row[12] ?? ''),
          }) as usingChannelProps
      );
    }
  } catch (err) {
    console.error('Excel 데이터 조회 실패:', err);

    if ((err as any)?.status === 401) {
      const newToken = await getGoogleToken();
      if (newToken) {
        return getExcelData(newToken, category, sheetName, spreadSheetId);
      }
    }

    throw err;
  }
}

// 첫 번째 행(최신 데이터)만 가져오기
export async function getExcelLastData({
  spreadsheetId,
}: { spreadsheetId?: string } = {}): Promise<usingDataProps[]> {
  try {
    const token = await getGoogleToken();
    if (!token) throw new Error('인증 토큰이 없습니다');

    const sheetName = localStorage.getItem('sheetName') || 'Sheet1';
    const sheets = getSheetsClient();
    const LASTCOLUMN = 'M';
    const range = buildSheetRange(
      sheetName,
      `B${STARTROW}:${LASTCOLUMN}${STARTROW}`
    );

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: spreadsheetId || import.meta.env.VITE_SPREADSHEET_ID,
      range,
    });

    const values = response.result.values || [];
    const validRows = filterRows(values);

    return validRows.map(
      (row) =>
        ({
          episodeId: Number(row[0] ?? 0),
          usageYn: String(row[1] ?? ''),
          channelName: String(row[2] ?? ''),
          episodeName: String(row[3] ?? ''),
          dispDtime: String(row[4] ?? ''),
          createdAt: String(row[5] ?? ''),
          playTime: parsePlayTime(row[6] ?? 0),
          likeCnt: Number(row[7] ?? 0),
          listenCnt: Number(row[8] ?? 0),
          thumbnailUrl: String(row[9] ?? ''),
          audioUrl: String(row[10] ?? ''),
          channelId: Number(row[11] ?? 0),
        }) as usingDataProps
    );
  } catch (err) {
    console.error('Excel 마지막 데이터 조회 실패:', err);

    if ((err as any)?.status === 401) {
      const newToken = await getGoogleToken();
      if (newToken) {
        return getExcelLastData();
      }
    }

    throw err;
  }
}

const filterRows = (rows: any[][]) => {
  return rows.filter(
    (row) => row[0] !== null && row[0] !== undefined && row[0] !== ''
  );
};

// 데이터 업데이트
export async function addMissingRows(
  allData: usingChannelProps[],
  token: string,
  setProgress: (message: string) => void,
  category: 'channel',
  setAllLoading: (loading: boolean) => void,
  spreadsheetId?: string,
  sheetName?: string
): Promise<void>;
export async function addMissingRows(
  allData: usingDataProps[],
  token: string,
  setProgress: (message: string) => void,
  category: 'episode',
  setAllLoading: (loading: boolean) => void,
  spreadsheetId?: string,
  sheetName?: string
): Promise<void>;

export async function addMissingRows(
  allData: (usingDataProps | usingChannelProps)[],
  token: string,
  setProgress: (message: string) => void,
  category: 'episode' | 'channel',
  setAllLoading: (loading: boolean) => void,
  spreadsheetId?: string,
  sheetName?: string
) {
  try {
    setAllLoading(true);
    const targetSheetName = resolveSheetName(category, sheetName);
    const existingData = await getExcelData(
      token,
      category,
      targetSheetName,
      spreadsheetId
    );

    const missingRows = allData.filter(
      (item) =>
        !existingData.some(
          (row) =>
            ('episodeId' in row &&
              'episodeId' in item &&
              row.episodeId === item.episodeId) ||
            ('channelId' in row &&
              'channelId' in item &&
              row.channelId === item.channelId)
        )
    );

    if (missingRows.length === 0) {
      toast.success('추가할 누락 데이터가 없습니다!');
      setAllLoading(false);
      return;
    }

    const batchSize = 10000;
    const sheets = getSheetsClient();

    for (let i = 0; i < missingRows.length; i += batchSize) {
      const batch = missingRows.slice(i, i + batchSize) as (
        | usingDataProps
        | usingChannelProps
      )[];
      let values;
      let lastColumn;

      if (category === 'episode') {
        values = (batch as usingDataProps[]).map((row) => [
          row.episodeId,
          row.usageYn,
          row.channelName,
          row.episodeName,
          formatDateString(row.dispDtime),
          formatDateString(row.createdAt),
          formatPlayTime(row.playTime),
          row.likeCnt,
          row.listenCnt,
          row.thumbnailUrl,
          row.audioUrl,
          row.channelId,
        ]);
        lastColumn = 'M';
      } else {
        values = (batch as usingChannelProps[]).map((row, index) => {
          // 첫 번째 행의 dispDtime 확인 (디버깅용)
          if (index === 0) {
            console.log('Excel 저장 - 첫 번째 채널 데이터:', row);
            console.log('Excel 저장 - dispDtime 원본 값:', row.dispDtime);
            console.log(
              'Excel 저장 - dispDtime 포맷 후:',
              formatDateString(row.dispDtime)
            );
          }

          return [
            row.channelId,
            row.usageYn,
            row.channelName,
            row.vendorName,
            row.categoryName,
            row.episodeCount ?? 0,
            formatDateString(row.dispDtime),
            row.channelTypeName,
            row.likeCnt,
            row.listenCnt,
            formatDateString(row.createdAt),
            row.interfaceUrl,
            row.thumbnailUrl,
          ];
        });
        lastColumn = 'N';
      }

      const startRow = existingData.length + i + STARTROW;
      const endRow = startRow + batch.length - 1;
      const range = `${targetSheetName}!B${startRow}:${lastColumn}${endRow}`;

      setProgress(`${Math.round((i / missingRows.length) * 100)}%`);

      await sheets.spreadsheets.values.update({
        spreadsheetId: spreadsheetId || import.meta.env.VITE_SPREADSHEET_ID,
        range,
        valueInputOption: 'RAW',
        resource: { values },
      });
    }

    toast.success('전체 데이터 업데이트 완료!');
  } catch (err) {
    console.error('데이터 추가 실패:', err);
    toast.error('전체 데이터 업데이트 실패!');

    if ((err as any)?.status === 401) {
      const newToken = await getGoogleToken();
      if (newToken) {
        if (category === 'episode') {
          return addMissingRows(
            allData as usingDataProps[],
            newToken,
            setProgress,
            'episode',
            setAllLoading,
            spreadsheetId,
            sheetName
          );
        } else {
          return addMissingRows(
            allData as usingChannelProps[],
            newToken,
            setProgress,
            'channel',
            setAllLoading,
            spreadsheetId,
            sheetName
          );
        }
      }
    }

    throw err;
  } finally {
    setProgress('');
    setAllLoading(false);
  }
}

// 데이터 덮어쓰기
export async function overwriteExcelData(
  data: (usingDataProps | usingChannelProps)[],
  _token: string,
  category: 'episode' | 'channel',
  sheetName?: string,
  spreadsheetId?: string,
  startRow?: number,
  setProgress?: (msg: string) => void
) {
  const WRITE_BATCH_SIZE = 10000;
  const targetSpreadsheetId =
    spreadsheetId || import.meta.env.VITE_SPREADSHEET_ID;
  const targetSheet =
    sheetName || localStorage.getItem('sheetName') || 'Sheet1';
  const targetStartRow = startRow ?? STARTROW;

  try {
    const sheets = getSheetsClient();

    // 1. 시트 ID와 현재 행 수 조회
    setProgress?.('시트 정보 조회 중...');
    const meta = await sheets.spreadsheets.get({
      spreadsheetId: targetSpreadsheetId,
    });
    const sheetMeta = meta.result.sheets?.find(
      (s) => s.properties?.title === targetSheet
    );
    const sheetId = sheetMeta?.properties?.sheetId;
    const currentRowCount = sheetMeta?.properties?.gridProperties?.rowCount ?? 0;
    if (sheetId === undefined || sheetId === null) {
      throw new Error(`시트를 찾을 수 없습니다: ${targetSheet}`);
    }

    // 2. 기존 데이터 영역을 비움
    setProgress?.('기존 데이터 영역 초기화 중...');
    await sheets.spreadsheets.values.clear({
      spreadsheetId: targetSpreadsheetId,
      range: buildSheetRange(
        targetSheet,
        `B${targetStartRow}:${category === 'episode' ? 'M' : 'N'}${MAX_ROWS}`
      ),
      resource: {},
    });

    // 3. 데이터 포맷
    let values: (string | number)[][];

    if (category === 'episode') {
      values = (data as usingDataProps[]).map((row) => [
        row.episodeId,
        row.usageYn,
        row.channelName,
        row.episodeName,
        formatDateString(row.dispDtime),
        formatDateString(row.createdAt),
        formatPlayTime(row.playTime),
        row.likeCnt,
        row.listenCnt,
        row.thumbnailUrl,
        row.audioUrl,
        row.channelId,
      ]);
    } else {
      values = (data as usingChannelProps[]).map((row) => [
        row.channelId,
        row.usageYn,
        row.channelName,
        row.vendorName,
        row.categoryName,
        row.episodeCount ?? 0,
        formatDateString(row.dispDtime),
        row.channelTypeName,
        row.likeCnt,
        row.listenCnt,
        formatDateString(row.createdAt),
        row.interfaceUrl,
        row.thumbnailUrl,
      ]);
    }

    // 4. 필요한 행 수만큼 시트 확장
    const requiredLastRow = Math.max(targetStartRow, targetStartRow + values.length - 1);
    if (requiredLastRow > currentRowCount) {
      setProgress?.('시트 행 확장 중...');
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: targetSpreadsheetId,
        resource: {
          requests: [
            {
              updateSheetProperties: {
                properties: {
                  sheetId,
                  gridProperties: {
                    rowCount: requiredLastRow + 100,
                  },
                },
                fields: 'gridProperties.rowCount',
              },
            },
          ],
        },
      });
    }

    // 5. 정확한 범위에 배치 쓰기
    //    - 전체 재적재는 append보다 update가 안정적이다.
    for (let i = 0; i < values.length; i += WRITE_BATCH_SIZE) {
      const batch = values.slice(i, i + WRITE_BATCH_SIZE);
      const percent = Math.round(((i + batch.length) / values.length) * 100);
      setProgress?.(`데이터 쓰기 중... ${percent}%`);

      const batchStartRow = targetStartRow + i;

      await sheets.spreadsheets.values.update({
        spreadsheetId: targetSpreadsheetId,
        range: buildSheetRange(targetSheet, `B${batchStartRow}`),
        valueInputOption: 'RAW',
        resource: { values: batch },
      });
    }

    toast.success('데이터 덮어쓰기 완료!');
  } catch (err) {
    console.error('데이터 덮어쓰기 실패:', err);
    toast.error('데이터 덮어쓰기 실패!');

    if ((err as any)?.status === 401) {
      const newToken = await getGoogleToken();
      if (newToken) {
        return overwriteExcelData(
          data,
          newToken,
          category,
          sheetName,
          spreadsheetId,
          startRow,
          setProgress
        );
      }
    }

    throw err;
  }
}

// 범위 삭제
export async function clearExcelRange(
  range: string,
  sheetName?: string,
  spreadSheetId?: string
) {
  try {
    const token = await getGoogleToken();
    if (!token) throw new Error('인증 토큰이 없습니다');

    const targetSheet =
      sheetName || localStorage.getItem('sheetName') || 'Sheet1';
    const sheets = getSheetsClient();
    const fullRange = buildSheetRange(targetSheet, range);

    await sheets.spreadsheets.values.clear({
      spreadsheetId: spreadSheetId || import.meta.env.VITE_SPREADSHEET_ID,
      range: fullRange,
      resource: {},
    });

    toast.success('데이터 삭제 완료!');
  } catch (err) {
    console.error('데이터 삭제 실패:', err);
    toast.error('데이터 삭제 실패!');
    throw err;
  }
}
