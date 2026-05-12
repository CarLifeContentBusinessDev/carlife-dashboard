import {
  PICKNOW_CONFIGURATION_DATA_RANGE,
  PICKNOW_CONFIGURATION_HEADER_RANGE,
  PICKNOW_CONFIGURATION_HEADERS,
} from '../../constants/picknowExcel';
import {
  getGoogleToken,
  getSheetsClient,
  initializeGoogleAPI,
} from '../auth/auth';
import { buildSheetRange } from '../excel/sheetRange';

export async function preparePicknowConfigurationSheet(
  sheetName: string,
  spreadsheetId: string = import.meta.env.VITE_PICKNOW_SPREADSHEET_ID as string
): Promise<number> {
  const targetSheetName = sheetName.trim();

  if (!targetSheetName) {
    throw new Error('시트명이 비어 있습니다.');
  }

  await initializeGoogleAPI();

  const token = await getGoogleToken();
  if (!token) {
    throw new Error(
      'Google 인증 토큰이 없습니다. 로그인 후 다시 시도해주세요.'
    );
  }

  gapi.client.setToken({ access_token: token });

  const sheets = getSheetsClient();
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
  const existingSheet = spreadsheet.result.sheets?.find((sheet) => {
    const title = sheet.properties?.title ?? '';
    return title.trim() === targetSheetName;
  });

  let sheetId: number;
  if (!existingSheet) {
    const addSheetResponse = await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: {
        requests: [
          {
            addSheet: {
              properties: {
                title: targetSheetName,
              },
            },
          },
        ],
      },
    });
    sheetId =
      addSheetResponse.result.replies?.[0]?.addSheet?.properties?.sheetId ?? 0;
  } else {
    sheetId = existingSheet.properties?.sheetId ?? 0;
  }

  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: buildSheetRange(targetSheetName, PICKNOW_CONFIGURATION_DATA_RANGE),
    resource: {},
  });

  if (!existingSheet) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: buildSheetRange(
        targetSheetName,
        PICKNOW_CONFIGURATION_HEADER_RANGE
      ),
      valueInputOption: 'RAW',
      resource: {
        values: [PICKNOW_CONFIGURATION_HEADERS],
      },
    });

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: {
        requests: [
          {
            updateCells: {
              range: {
                sheetId,
                startRowIndex: 1,
                endRowIndex: 2,
                startColumnIndex: 1,
                endColumnIndex: 26, // Z열
              },
              rows: [
                {
                  values: PICKNOW_CONFIGURATION_HEADERS.map(() => ({
                    userEnteredFormat: {
                      backgroundColor: {
                        red: 0.93,
                        green: 0.93,
                        blue: 0.93,
                      },
                      horizontalAlignment: 'CENTER',
                      textFormat: {
                        bold: true,
                      },
                    },
                  })),
                },
              ],
              fields:
                'userEnteredFormat.backgroundColor,userEnteredFormat.horizontalAlignment,userEnteredFormat.textFormat.bold',
            },
          },
          {
            repeatCell: {
              range: {
                sheetId,
                startRowIndex: 2,
                endRowIndex: 1000,
                startColumnIndex: 0,
                endColumnIndex: 21,
              },
              cell: {
                userEnteredFormat: {
                  horizontalAlignment: 'LEFT',
                  verticalAlignment: 'MIDDLE',
                  wrapStrategy: 'CLIP',
                },
              },
              fields:
                'userEnteredFormat(horizontalAlignment,verticalAlignment,wrapStrategy)',
            },
          },
          {
            updateDimensionProperties: {
              range: {
                sheetId,
                dimension: 'COLUMNS',
                startIndex: 0,
                endIndex: 1,
              },
              properties: {
                pixelSize: 20,
              },
              fields: 'pixelSize',
            },
          },
          {
            setBasicFilter: {
              filter: {
                range: {
                  sheetId,
                  startRowIndex: 1, // 헤더 2행
                  endRowIndex: 1000,
                  startColumnIndex: 1, // B열
                  endColumnIndex: 21, // U열
                },
              },
            },
          },
          {
            updateSheetProperties: {
              properties: {
                sheetId,
                gridProperties: {
                  columnCount: 21,
                  frozenRowCount: 2,
                },
              },
              fields:
                'gridProperties.columnCount,gridProperties.frozenRowCount',
            },
          },
        ],
      },
    });
  }

  // B1 셀에 개수 및 업데이트 시간 작성
  const now = new Date();
  const timestamp =
    String(now.getFullYear()).slice(-2) +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0') +
    ' ' +
    String(now.getHours()).padStart(2, '0') +
    ':' +
    String(now.getMinutes()).padStart(2, '0');
  const countFormula =
    '="총 " & SUBTOTAL(103, B3:B) & "개 (' + timestamp + ')"';

  try {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: buildSheetRange(targetSheetName, 'B1'),
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [[countFormula]],
      },
    });
  } catch (err) {
    console.warn('B1 업데이트 실패:', err);
  }

  return sheetId;
}
