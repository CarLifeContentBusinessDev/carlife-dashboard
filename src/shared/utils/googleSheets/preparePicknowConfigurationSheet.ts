import {
  PICKNOW_CONFIGURATION_DATA_RANGE,
  PICKNOW_CONFIGURATION_HEADER_RANGE,
  PICKNOW_CONFIGURATION_HEADERS,
} from '@/constants/picknowExcel';
import {
  batchUpdateSpreadsheet,
  clearSheetValues,
  getSpreadsheetMeta,
  updateSheetValues,
} from '@/feature/picknow/utils/picknowSheetApi';
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

  const spreadsheet = await getSpreadsheetMeta(spreadsheetId);
  const existingSheet = spreadsheet.sheets?.find((sheet) => {
    const title = sheet.properties?.title ?? '';
    return title.trim() === targetSheetName;
  });

  let sheetId: number;
  if (!existingSheet) {
    const addSheetResponse = await batchUpdateSpreadsheet(spreadsheetId, [
      { addSheet: { properties: { title: targetSheetName } } },
    ]);
    sheetId = addSheetResponse[0]?.addSheet?.properties?.sheetId ?? 0;
  } else {
    sheetId = existingSheet.properties?.sheetId ?? 0;
  }

  await clearSheetValues(
    spreadsheetId,
    buildSheetRange(targetSheetName, PICKNOW_CONFIGURATION_DATA_RANGE)
  );

  if (!existingSheet) {
    await updateSheetValues(
      spreadsheetId,
      buildSheetRange(targetSheetName, PICKNOW_CONFIGURATION_HEADER_RANGE),
      [PICKNOW_CONFIGURATION_HEADERS],
      'RAW'
    );

    await batchUpdateSpreadsheet(spreadsheetId, [
      {
        updateCells: {
          range: {
            sheetId,
            startRowIndex: 1,
            endRowIndex: 2,
            startColumnIndex: 1,
            endColumnIndex: 26,
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
            endColumnIndex: 25,
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
            startIndex: 6,
            endIndex: 8,
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
            startIndex: 8,
            endIndex: 12,
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
            startIndex: 16,
            endIndex: 21,
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
            startIndex: 21,
            endIndex: 25,
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
            startIndex: 25,
            endIndex: 26,
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
              columnCount: 26,
              frozenRowCount: 2,
            },
          },
          fields: 'gridProperties.columnCount,gridProperties.frozenRowCount',
        },
      },
    ]);
  }

  // 기본 필터(setBasicFilter)는 데이터를 쓴 뒤 syncPicknowConfigurationSheet에서 설정
  try {
    const latestSpreadsheet = await getSpreadsheetMeta(spreadsheetId);
    const targetSheet = latestSpreadsheet.sheets?.find(
      (s) => s.properties?.sheetId === sheetId
    );

    const requests: gapi.client.sheets.Request[] = [];
    const filterViews = targetSheet?.filterViews ?? [];
    for (const fv of filterViews) {
      if (fv && fv.filterViewId != null) {
        requests.push({ deleteFilterView: { filterId: fv.filterViewId } });
      }
    }

    requests.push({ clearBasicFilter: { sheetId } });

    if (requests.length > 0) {
      await batchUpdateSpreadsheet(spreadsheetId, requests);
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
    await updateSheetValues(
      spreadsheetId,
      buildSheetRange(targetSheetName, 'B1'),
      [[countFormula]],
      'USER_ENTERED'
    );
  } catch (err) {
    console.warn('B1 업데이트 실패:', err);
  }

  return sheetId;
}
