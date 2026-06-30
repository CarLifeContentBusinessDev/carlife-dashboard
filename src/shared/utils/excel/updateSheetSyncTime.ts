import { getGoogleToken, getSheetsClient } from '@/shared/utils/auth/auth';

const formatSyncTime = (date: Date) => {
  const yy = String(date.getFullYear() % 100).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');

  return `${yy}.${mm}.${dd} ${hh}:${min}`;
};

export async function updateSheetSyncTime(
  sheetName: string,
  spreadsheetId: string
): Promise<boolean> {
  try {
    await getGoogleToken();
    const sheets = getSheetsClient();

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!C2`,
      valueInputOption: 'RAW',
      resource: {
        values: [[formatSyncTime(new Date())]],
      },
    });

    return true;
  } catch (error) {
    console.error('시트 동기화 시간 업데이트 실패:', error);
    return false;
  }
}
