import {
  getGoogleToken,
  getSheetsClient,
  initializeGoogleAPI,
} from '../auth/auth';
import { buildSheetRange } from '../excel/sheetRange';

const PICKNOW_CONFIGURATION_HEADERS = [
  'index',
  'OEM',
  'Device',
  'Category',
  'Country',
  'Title',
  '홈화면 ON (Default, Recommended, Active)',
  'Orientation',
  'Range From',
  'Range To',
  'ZoomFactor',
  'UserAgentString',
  'WhiteList',
  'BlackList',
  'supportNewTab',
  'MouseOnlyPage',
];

const PICKNOW_CONFIGURATION_RANGE = 'A1:Q1000';
const PICKNOW_CONFIGURATION_HEADER_RANGE = 'B2:Q2';

export async function preparePicknowConfigurationSheet(
  sheetName: string,
  spreadsheetId: string = import.meta.env.VITE_PICKNOW_SPREADSHEET_ID as string
): Promise<void> {
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

  if (!existingSheet) {
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: buildSheetRange(targetSheetName, PICKNOW_CONFIGURATION_RANGE),
      resource: {},
    });
  } else {
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: buildSheetRange(targetSheetName, 'B3:Q1000'),
      resource: {},
    });
  }

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
                endColumnIndex: 17,
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
        ],
      },
    });
  }
}
