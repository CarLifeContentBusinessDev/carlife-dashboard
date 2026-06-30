import {
  PICKNOW_CONFIGURATION_DATA_RANGE,
  PICKNOW_CONFIGURATION_HEADER_RANGE,
  PICKNOW_CONFIGURATION_HEADERS,
} from '@/constants/picknowExcel';
import {
  getGoogleToken,
  getSheetsClient,
  initializeGoogleAPI,
} from '@/shared/utils/auth/auth';
import { buildSheetRange } from '@/shared/utils/excel/sheetRange';

export async function preparePicknowConfigurationSheet(
  sheetName: string,
  spreadsheetId: string = import.meta.env
    .VITE_PICKNOW_SPREADSHEET_ID_STG as string
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
                endColumnIndex: 25,
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
          // 텍스트 정렬 및 줄바꿈 설정
          {
            repeatCell: {
              range: {
                sheetId,
                startRowIndex: 2,
                endRowIndex: 1000,
                startColumnIndex: 0,
                endColumnIndex: 24,
              },
              cell: {
                userEnteredFormat: {
                  horizontalAlignment: 'LEFT',
                  verticalAlignment: 'MIDDLE',
                  wrapStrategy: 'WRAP',
                },
              },
              fields:
                'userEnteredFormat(horizontalAlignment,verticalAlignment,wrapStrategy)',
            },
          },
          // 열 너비 설정
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
            updateDimensionProperties: {
              range: {
                sheetId,
                dimension: 'COLUMNS',
                startIndex: 1,
                endIndex: 2,
              },
              properties: {
                pixelSize: 60,
              },
              fields: 'pixelSize',
            },
          },
          {
            updateDimensionProperties: {
              range: {
                sheetId,
                dimension: 'COLUMNS',
                startIndex: 2,
                endIndex: 4,
              },
              properties: {
                pixelSize: 180,
              },
              fields: 'pixelSize',
            },
          },
          {
            updateDimensionProperties: {
              range: {
                sheetId,
                dimension: 'COLUMNS',
                startIndex: 5,
                endIndex: 7,
              },
              properties: {
                pixelSize: 180,
              },
              fields: 'pixelSize',
            },
          },
          {
            updateDimensionProperties: {
              range: {
                sheetId,
                dimension: 'COLUMNS',
                startIndex: 7,
                endIndex: 11,
              },
              properties: {
                pixelSize: 80,
              },
              fields: 'pixelSize',
            },
          },
          {
            updateDimensionProperties: {
              range: {
                sheetId,
                dimension: 'COLUMNS',
                startIndex: 15,
                endIndex: 20,
              },
              properties: {
                pixelSize: 200,
              },
              fields: 'pixelSize',
            },
          },
          {
            updateDimensionProperties: {
              range: {
                sheetId,
                dimension: 'COLUMNS',
                startIndex: 20,
                endIndex: 24,
              },
              properties: {
                pixelSize: 140,
              },
              fields: 'pixelSize',
            },
          },
          {
            updateDimensionProperties: {
              range: {
                sheetId,
                dimension: 'COLUMNS',
                startIndex: 24,
                endIndex: 25,
              },
              properties: {
                pixelSize: 20,
              },
              fields: 'pixelSize',
            },
          },
          {
            updateSheetProperties: {
              properties: {
                sheetId,
                gridProperties: {
                  columnCount: 25,
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

  // 기본 필터(setBasicFilter)는 데이터를 쓴 뒤 syncPicknowConfigurationSheet에서 설정합니다.
  try {
    const latestSpreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    const targetSheet = latestSpreadsheet.result.sheets?.find(
      (s) => s.properties?.sheetId === sheetId
    );

    const requests: any[] = [];
    const filterViews = targetSheet?.filterViews ?? [];
    for (const fv of filterViews) {
      if (fv && fv.filterViewId != null) {
        requests.push({ deleteFilterView: { filterId: fv.filterViewId } });
      }
    }

    requests.push({ clearBasicFilter: { sheetId } });

    if (requests.length > 0) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        resource: { requests },
      });
    }
  } catch (err) {
    console.warn('필터뷰 삭제 실패:', err);
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
