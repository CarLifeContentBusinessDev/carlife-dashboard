import { toast } from 'react-toastify';
import type { usingCurationExcelProps } from '@/shared/types/pickleProdContents';
import {
  getGoogleApiErrorStatus,
  getGoogleToken,
  getSheetsClient,
} from '@/shared/utils/auth/auth';
import formatDateString from '@/shared/utils/format/formatDateString';
import {
  formatPlayTime,
  parsePlayTime,
} from '@/shared/utils/format/formatPlayTime';
import { getUsedRange } from './updateExcel';

export async function getCurationExcelData(
  _token: string,
  spreadsheetId: string,
  sheetName?: string
): Promise<usingCurationExcelProps[]> {
  const batchSize = 1000;
  const allRows: (string | number)[][] = [];
  const targetSheetName =
    sheetName || localStorage.getItem('sheetName') || 'Sheet1';
  let totalRows = await getUsedRange(targetSheetName, spreadsheetId);

  if (totalRows === null || totalRows < 4) {
    totalRows = 4;
  }

  const totalBatches = Math.ceil(totalRows / batchSize);
  const sheets = getSheetsClient();

  for (let i = 0; i < totalBatches; i++) {
    const startRow = i * batchSize + 4;
    const calculatedEndRow = startRow + batchSize - 1;
    const endRow = Math.min(calculatedEndRow, totalRows);
    const range = `${targetSheetName}!B${startRow}:W${endRow}`;

    try {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
      });
      const values = response.result.values as (string | number)[][];
      if (values && values.length > 0) allRows.push(...values);
    } catch (err: unknown) {
      if (getGoogleApiErrorStatus(err) === 401) {
        const refreshedToken = await getGoogleToken();
        if (!refreshedToken)
          throw new Error('토큰 재발급 실패, 엑셀 조회 중단');

        localStorage.setItem('googleAccessToken', refreshedToken);

        const retryResponse = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range,
        });

        const retryValues = retryResponse.result.values as (
          string | number
        )[][];
        if (retryValues && retryValues.length > 0) allRows.push(...retryValues);
      } else {
        console.error('엑셀 조회 실패:', err);
      }
    }
  }

  const validRows = allRows.filter(
    (row) => row[1] !== null && row[1] !== undefined && row[1] !== ''
  );

  return validRows.map(
    (row) =>
      ({
        thumbnailTitle: String(row[0] ?? ''),
        curationType: String(row[1] ?? ''),
        curationName: String(row[2] ?? ''),
        curationDesc: String(row[3] ?? ''),
        activeState: String(row[4] ?? ''),
        exhibitionState: String(row[5] ?? ''),
        field: String(row[6] ?? ''),
        section: Number(row[7] ?? undefined),
        dispStartDtime: String(row[8] ?? ''),
        dispEndDtime: String(row[9] ?? ''),
        curationCreatedAt: String(row[10] ?? ''),
        channelId: Number(row[11] ?? 0),
        episodeId: Number(row[12] ?? 0),
        usageYn: String(row[13] ?? ''),
        channelName: String(row[14] ?? ''),
        episodeName: String(row[15] ?? ''),
        dispDtime: String(row[16] ?? ''),
        createdAt: String(row[17] ?? ''),
        playTime: parsePlayTime(row[18] ?? 0),
        likeCnt: Number(row[19] ?? 0),
        listenCnt: Number(row[20] ?? 0),
        uploader: String(row[21] ?? ''),
      }) as usingCurationExcelProps
  );
}

export async function overwriteCurationExcelData(
  data: usingCurationExcelProps[],
  _token: string,
  sheetName?: string,
  spreadsheetId?: string
): Promise<void> {
  try {
    const targetSpreadsheetId =
      spreadsheetId || import.meta.env.VITE_SPREADSHEET_ID;
    const targetSheet =
      sheetName || localStorage.getItem('sheetName') || 'Sheet1';
    const sheets = getSheetsClient();

    const values = (data as usingCurationExcelProps[]).map((row) => [
      row.thumbnailTitle,
      row.curationType,
      row.curationName,
      row.curationDesc,
      row.activeState,
      row.exhibitionState,
      row.field,
      row.section,
      formatDateString(row.dispStartDtime),
      formatDateString(row.dispEndDtime),
      formatDateString(row.curationCreatedAt),
      row.channelId,
      row.episodeId,
      row.usageYn,
      row.channelName,
      row.episodeName,
      formatDateString(row.dispDtime),
      formatDateString(row.createdAt),
      formatPlayTime(row.playTime ?? 0),
      row.likeCnt,
      row.listenCnt,
      row.uploader,
      '',
    ]);

    const STARTROW = 4;
    const MAX_ROWS = 300000;
    const lastColumn = 'X';

    const range = `${targetSheet}!B${STARTROW}:${lastColumn}${STARTROW + values.length - 1}`;
    const clearRange = `${targetSheet}!B${STARTROW}:${lastColumn}${MAX_ROWS}`;

    await sheets.spreadsheets.values.clear({
      spreadsheetId: targetSpreadsheetId,
      range: clearRange,
      resource: {},
    });

    await sheets.spreadsheets.values.update({
      spreadsheetId: targetSpreadsheetId,
      range,
      valueInputOption: 'RAW',
      resource: { values },
    });

    // rowCount를 데이터 수에 맞게 정확히 조정하고 필터 범위 갱신
    const meta = await sheets.spreadsheets.get({
      spreadsheetId: targetSpreadsheetId,
    });
    const sheetMeta = meta.result.sheets?.find(
      (s) => s.properties?.title === targetSheet
    );
    const sheetId = sheetMeta?.properties?.sheetId;

    if (sheetId !== undefined && sheetId !== null) {
      const exactRowCount = STARTROW - 1 + values.length + 1;
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: targetSpreadsheetId,
        resource: {
          requests: [
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
                    startRowIndex: STARTROW - 2,
                    endRowIndex: exactRowCount - 1,
                    startColumnIndex: 1,
                    endColumnIndex: 23,
                  },
                },
              },
            },
          ],
        },
      });
    }

    toast.success('큐레이션 데이터 덮어쓰기 완료!');
  } catch (err) {
    console.error('큐레이션 데이터 덮어쓰기 실패:', err);
    toast.error('큐레이션 데이터 덮어쓰기 실패!');

    if (getGoogleApiErrorStatus(err) === 401) {
      const newToken = await getGoogleToken();
      if (newToken) {
        return overwriteCurationExcelData(
          data,
          newToken,
          sheetName,
          spreadsheetId
        );
      }
    }

    throw err;
  }
}

export async function addMissingCurationRows(
  allData: usingCurationExcelProps[],
  token: string,
  setProgress: (message: string) => void,
  spreadsheetId?: string
) {
  const existingData = await getCurationExcelData(
    token,
    spreadsheetId || import.meta.env.VITE_SPREADSHEET_ID
  );

  const missingRows = allData.filter(
    (item) => !existingData.some((row) => row.episodeId === item.episodeId)
  );

  if (missingRows.length === 0) {
    toast.success('추가할 누락 데이터가 없습니다!');
    return;
  }

  const batchSize = 100;
  const sheets = getSheetsClient();

  for (let i = 0; i < missingRows.length; i += batchSize) {
    const batch = missingRows.slice(
      i,
      i + batchSize
    ) as usingCurationExcelProps[];

    const sheetName = localStorage.getItem('sheetName');
    const values = (batch as usingCurationExcelProps[]).map((row) => [
      row.thumbnailTitle,
      row.curationType,
      row.curationName,
      row.curationDesc,
      row.activeState,
      row.exhibitionState,
      row.field,
      row.section,
      formatDateString(row.dispStartDtime),
      formatDateString(row.dispEndDtime),
      formatDateString(row.curationCreatedAt),
      row.channelId,
      row.episodeId,
      row.usageYn,
      row.channelName,
      row.episodeName,
      formatDateString(row.dispDtime),
      formatDateString(row.createdAt),
      formatPlayTime(row.playTime ?? 0),
      row.likeCnt,
      row.listenCnt,
      row.uploader,
      '',
    ]);

    const startRow = existingData.length + i + 4;
    const endRow = startRow + batch.length - 1;
    const range = `${sheetName}!B${startRow}:X${endRow}`;

    try {
      setProgress(`${Math.round((i / missingRows.length) * 100)}%`);
      await sheets.spreadsheets.values.update({
        spreadsheetId: spreadsheetId || import.meta.env.VITE_SPREADSHEET_ID,
        range,
        valueInputOption: 'RAW',
        resource: { values },
      });
    } catch (err: unknown) {
      if (getGoogleApiErrorStatus(err) === 401) {
        const refreshedToken = await getGoogleToken();
        if (!refreshedToken)
          throw new Error('토큰 재발급 실패, 엑셀 업데이트 중단');

        token = refreshedToken;
        localStorage.setItem('googleAccessToken', token);

        await sheets.spreadsheets.values.update({
          spreadsheetId: spreadsheetId || import.meta.env.VITE_SPREADSHEET_ID,
          range,
          valueInputOption: 'RAW',
          resource: { values },
        });
      } else {
        throw err;
      }
    }
  }

  toast.success('엑셀 업데이트 완료!');
}
