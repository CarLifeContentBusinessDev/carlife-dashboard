import { getSpreadsheetMeta } from '@/feature/pickle-prod/utils/pickleProdSheetApi';

const getSheetList = async (spreadsheetId: string) => {
  try {
    const spreadsheet = await getSpreadsheetMeta(spreadsheetId);

    const sheetList = spreadsheet.sheets?.map((sheet) => ({
      id: String(sheet.properties?.sheetId ?? ''),
      name: sheet.properties?.title ?? '',
    }));

    return sheetList || [];
  } catch (err) {
    console.error('시트 목록 조회 실패:', err);
    return [];
  }
};

export default getSheetList;
