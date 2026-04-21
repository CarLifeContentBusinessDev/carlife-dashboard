import { toast } from 'react-toastify';
import type { usingCurationExcelProps } from '../../types/type';
import { getGoogleToken, getSheetsClient } from '../auth/auth';
import formatDateString from '../format/formatDateString';
import { formatPlayTime, parsePlayTime } from '../format/formatPlayTime';
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
      if ((err as any)?.status === 401) {
        const refreshedToken = await getGoogleToken();
        if (!refreshedToken)
          throw new Error('토큰 재발급 실패, 엑셀 조회 중단');

        localStorage.setItem('loginToken', refreshedToken);

        const retryResponse = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range,
        });

        const retryValues = retryResponse.result.values as (
          | string
          | number
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
    ]);

    const STARTROW = 4;
    const MAX_ROWS = 300000;
    const lastColumn = 'W';

    const range = `${targetSheet}!B${STARTROW}:${lastColumn}${STARTROW + values.length - 1}`;
    const clearRange = `${targetSheet}!B${STARTROW}:${lastColumn}${MAX_ROWS}`;

    await sheets.spreadsheets.values.clear({
      spreadsheetId: spreadsheetId || import.meta.env.VITE_SPREADSHEET_ID,
      range: clearRange,
      resource: {},
    });

    await sheets.spreadsheets.values.update({
      spreadsheetId: spreadsheetId || import.meta.env.VITE_SPREADSHEET_ID,
      range,
      valueInputOption: 'RAW',
      resource: { values },
    });

    toast.success('큐레이션 데이터 덮어쓰기 완료!');
  } catch (err) {
    console.error('큐레이션 데이터 덮어쓰기 실패:', err);
    toast.error('큐레이션 데이터 덮어쓰기 실패!');

    if ((err as any)?.status === 401) {
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
    let values;

    const sheetName = localStorage.getItem('sheetName');
    values = (batch as usingCurationExcelProps[]).map((row) => [
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
    ]);

    const startRow = existingData.length + i + 4;
    const endRow = startRow + batch.length - 1;
    const range = `${sheetName}!B${startRow}:W${endRow}`;

    try {
      setProgress(`${Math.round((i / missingRows.length) * 100)}%`);
      await sheets.spreadsheets.values.update({
        spreadsheetId: spreadsheetId || import.meta.env.VITE_SPREADSHEET_ID,
        range,
        valueInputOption: 'RAW',
        resource: { values },
      });
    } catch (err: unknown) {
      if ((err as any)?.status === 401) {
        const refreshedToken = await getGoogleToken();
        if (!refreshedToken)
          throw new Error('토큰 재발급 실패, 엑셀 업데이트 중단');

        token = refreshedToken;
        localStorage.setItem('loginToken', token);

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
