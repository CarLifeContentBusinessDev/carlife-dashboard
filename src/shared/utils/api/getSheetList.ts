import { getGoogleToken, getSheetsClient } from '@/shared/utils/auth/auth';

const getSheetList = async (spreadsheetId: string) => {
  try {
    const token = await getGoogleToken();
    if (!token) {
      console.error('인증 토큰이 없습니다');
      return [];
    }

    const sheets = getSheetsClient();
    const response = await sheets.spreadsheets.get({
      spreadsheetId,
    });

    const sheetList = response.result.sheets?.map((sheet) => ({
      id: String(sheet.properties?.sheetId ?? ''),
      name: sheet.properties?.title ?? '',
    }));

    return sheetList || [];
  } catch (err) {
    console.error('시트 목록 조회 실패:', err);

    if ((err as any)?.status === 401) {
      console.warn('토큰 만료, 재발급 시도');
      const newToken = await getGoogleToken();

      if (!newToken) {
        console.error('토큰 재발급 실패');
        return [];
      }

      try {
        const sheets = getSheetsClient();
        const retryResponse = await sheets.spreadsheets.get({
          spreadsheetId,
        });

        localStorage.setItem('googleAccessToken', newToken);

        const sheetList = retryResponse.result.sheets?.map((sheet) => ({
          id: String(sheet.properties?.sheetId ?? ''),
          name: sheet.properties?.title ?? '',
        }));

        return sheetList || [];
      } catch (retryErr) {
        console.error('토큰 재발급 후에도 실패:', retryErr);
        return [];
      }
    }

    return [];
  }
};

export default getSheetList;
