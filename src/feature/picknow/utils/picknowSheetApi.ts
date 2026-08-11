const ENDPOINT = '/api/picknow-sheet';

async function callPicknowSheetApi<T>(body: unknown): Promise<T> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error ?? 'Goggle Sheets 요청에 실패했습니다.');
  }
  return json as T;
}

export async function getSheetValues(
  spreadsheetId: string,
  range: string
): Promise<string[][]> {
  const { values } = await callPicknowSheetApi<{ values: string[][] }>({
    action: 'valuesGet',
    spreadsheetId,
    range,
  });
  return values ?? [];
}

export async function updateSheetValues(
  spreadsheetId: string,
  range: string,
  values: (string | number)[][],
  valueInputOption: 'RAW' | 'USER_ENTERED' = 'RAW'
): Promise<void> {
  await callPicknowSheetApi({
    action: 'valuesUpdate',
    spreadsheetId,
    range,
    values,
    valueInputOption,
  });
}

export async function clearSheetValues(
  spreadsheetId: string,
  range: string
): Promise<void> {
  await callPicknowSheetApi({
    action: 'valuesClear',
    spreadsheetId,
    range,
  });
}

export async function getSpreadsheetMeta(
  spreadsheetId: string
): Promise<gapi.client.sheets.Spreadsheet> {
  const { spreadsheet } = await callPicknowSheetApi<{
    spreadsheet: gapi.client.sheets.Spreadsheet;
  }>({ action: 'spreadsheetsGet', spreadsheetId });
  return spreadsheet;
}

export async function batchUpdateSpreadsheet(
  spreadsheetId: string,
  requests: gapi.client.sheets.Request[]
): Promise<gapi.client.sheets.Response[]> {
  const { replies } = await callPicknowSheetApi<{
    replies: gapi.client.sheets.Response[];
  }>({
    action: 'batchUpdate',
    spreadsheetId,
    requests,
  });
  return replies ?? [];
}
