import { toast } from 'react-toastify';
import {
  batchUpdateSpreadsheet,
  clearSheetValues,
  getSheetValues,
  getSpreadsheetMeta,
  updateSheetValues,
} from '@/feature/pickle-prod/utils/pickleProdSheetApi';
import type {
  usingChannelProps,
  usingDataProps,
} from '@/shared/types/pickleProdContents';
import formatDateString from '@/shared/utils/format/formatDateString';
import {
  formatPlayTime,
  parsePlayTime,
} from '@/shared/utils/format/formatPlayTime';
import { chunkValuesBySize } from './chunkValuesBySize';
import { buildSheetRange } from './sheetRange';

const STARTROW = 4;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const resolveSheetName = (
  category: 'episode' | 'channel',
  sheetName?: string
) => {
  if (sheetName) return sheetName;

  const isStaging = window.location.pathname.startsWith('/pickle/stg');
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
    const targetSheet =
      sheetName || localStorage.getItem('sheetName') || '시트를 선택해주세요.';

    const values = await getSheetValues(
      spreadsheetId || import.meta.env.VITE_SPREADSHEET_ID,
      buildSheetRange(targetSheet, `D1:D`)
    );

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
  category: 'channel',
  sheetName?: string,
  spreadSheetId?: string
): Promise<usingChannelProps[]>;
export async function getExcelData(
  category: 'episode',
  sheetName?: string,
  spreadSheetId?: string
): Promise<usingDataProps[]>;
export async function getExcelData(
  category: 'episode' | 'channel',
  sheetName?: string,
  spreadSheetId?: string
): Promise<(usingDataProps | usingChannelProps)[]>;

export async function getExcelData(
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

    const lastColumn = category === 'episode' ? 'M' : 'N';
    const range = buildSheetRange(
      targetSheet,
      `B${STARTROW}:${lastColumn}${totalRows}`
    );

    const values = await getSheetValues(
      spreadSheetId || import.meta.env.VITE_SPREADSHEET_ID,
      range
    );

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
            categoryList: row[4]
              ? [
                  {
                    categoryId: 0,
                    categoryName: String(row[4]),
                    displayOrder: 0,
                  },
                ]
              : [],
            categoryId: 0,
            categoryName: String(row[4] ?? ''),
            interfaceType: '',
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
    throw err;
  }
}

const filterRows = (rows: (string | number)[][]) => {
  return rows.filter(
    (row) => row[0] !== null && row[0] !== undefined && row[0] !== ''
  );
};

// 데이터 덮어쓰기
export async function overwriteExcelData(
  data: (usingDataProps | usingChannelProps)[],
  category: 'episode' | 'channel',
  sheetName?: string,
  spreadsheetId?: string,
  startRow?: number,
  setProgress?: (msg: string) => void
) {
  const targetSpreadsheetId =
    spreadsheetId || import.meta.env.VITE_SPREADSHEET_ID;
  const targetSheet =
    sheetName || localStorage.getItem('sheetName') || 'Sheet1';
  const targetStartRow = startRow ?? STARTROW;

  try {
    // 1. 시트 ID와 현재 행 수 조회
    setProgress?.('시트 정보 조회 중...');
    const meta = await getSpreadsheetMeta(targetSpreadsheetId);
    const sheetMeta = meta.sheets?.find(
      (s) => s.properties?.title === targetSheet
    );
    const sheetId = sheetMeta?.properties?.sheetId;
    const currentRowCount =
      sheetMeta?.properties?.gridProperties?.rowCount ?? 0;
    if (sheetId === undefined || sheetId === null) {
      throw new Error(`시트를 찾을 수 없습니다: ${targetSheet}`);
    }

    // 2. 기존 데이터 영역을 비움
    setProgress?.('기존 데이터 영역 초기화 중...');
    await clearSheetValues(
      targetSpreadsheetId,
      buildSheetRange(targetSheet, `B${targetStartRow}:N`)
    );

    // 3. 데이터 포맷
    let values: (string | number)[][];

    if (category === 'episode') {
      // 등록일(createdAt) 내림차순, 동률 시 게시일시(dispDtime) 내림차순
      const sorted = [...(data as usingDataProps[])].sort((a, b) => {
        const createdDiff =
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        if (createdDiff !== 0) return createdDiff;
        return new Date(b.dispDtime).getTime() - new Date(a.dispDtime).getTime();
      });
      values = sorted.map((row) => [
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
        '',
      ]);
    } else {
      values = (data as usingChannelProps[]).map((row) => [
        row.channelId,
        row.usageYn,
        row.channelName,
        row.vendorName,
        row.categoryList?.map((c) => c.categoryName).join(', ') ?? '',
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
    const requiredLastRow = Math.max(
      targetStartRow,
      targetStartRow + values.length - 1
    );
    if (requiredLastRow > currentRowCount) {
      setProgress?.('시트 행 확장 중...');
      await batchUpdateSpreadsheet(targetSpreadsheetId, [
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
      ]);
    }

    // 5. 정확한 범위에 배치 쓰기 (Vercel 요청 본문 4.5MB 한도를 넘지 않도록 크기 기준 청킹)
    const chunks = chunkValuesBySize(values);
    let writtenRows = 0;
    for (const chunk of chunks) {
      const batchStartRow = targetStartRow + chunk.offset;

      await updateSheetValues(
        targetSpreadsheetId,
        buildSheetRange(targetSheet, `B${batchStartRow}`),
        chunk.rows
      );

      writtenRows += chunk.rows.length;
      const percent = Math.round((writtenRows / values.length) * 100);
      setProgress?.(`데이터 쓰기 중... ${percent}%`);

      // Google Sheets 쓰기 쿼터(사용자당 60회/분) 완화
      if (chunks.length > 1) await delay(300);
    }

    // 6. rowCount를 데이터 수에 맞게 정확히 조정하고 필터 범위 갱신
    setProgress?.('시트 행 수 및 필터 조정 중...');
    const exactRowCount = targetStartRow - 1 + values.length + 1;
    const lastColIndex = category === 'episode' ? 13 : 14;
    await batchUpdateSpreadsheet(targetSpreadsheetId, [
      {
        updateSheetProperties: {
          properties: {
            sheetId,
            gridProperties: { rowCount: exactRowCount },
          },
          fields: 'gridProperties.rowCount',
        },
      },
      {
        setBasicFilter: {
          filter: {
            range: {
              sheetId,
              startRowIndex: targetStartRow - 2,
              endRowIndex: exactRowCount - 1,
              startColumnIndex: 1,
              endColumnIndex: lastColIndex,
            },
          },
        },
      },
    ]);

    toast.success('데이터 덮어쓰기 완료!');
  } catch (err) {
    console.error('데이터 덮어쓰기 실패:', err);
    toast.error('데이터 덮어쓰기 실패!');
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
    const targetSheet =
      sheetName || localStorage.getItem('sheetName') || 'Sheet1';
    const fullRange = buildSheetRange(targetSheet, range);

    await clearSheetValues(
      spreadSheetId || import.meta.env.VITE_SPREADSHEET_ID,
      fullRange
    );

    toast.success('데이터 삭제 완료!');
  } catch (err) {
    console.error('데이터 삭제 실패:', err);
    toast.error('데이터 삭제 실패!');
    throw err;
  }
}
