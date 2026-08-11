const ENDPOINT = '/api/pickle-sheet';

async function callPickleSheetApi<T>(body: unknown): Promise<T> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error ?? 'Google Sheets 요청에 실패했습니다.');
  }
  return json as T;
}

export async function getSheetValues(
  spreadsheetId: string,
  range: string
): Promise<string[][]> {
  const { values } = await callPickleSheetApi<{ values: string[][] }>({
    action: 'valuesGet',
    spreadsheetId,
    range,
  });
  return values ?? [];
}

export async function updateSheetValues(
  spreadsheetId: string,
  range: string,
  values: (string | number | undefined)[][],
  valueInputOption: 'RAW' | 'USER_ENTERED' = 'RAW'
): Promise<void> {
  await callPickleSheetApi({
    action: 'valuesUpdate',
    spreadsheetId,
    range,
    values,
    valueInputOption,
  });
}

export async function appendSheetValues(
  spreadsheetId: string,
  range: string,
  values: (string | number | undefined)[][],
  valueInputOption: 'RAW' | 'USER_ENTERED' = 'RAW'
): Promise<void> {
  await callPickleSheetApi({
    action: 'valuesAppend',
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
  await callPickleSheetApi({
    action: 'valuesClear',
    spreadsheetId,
    range,
  });
}

export async function getSpreadsheetMeta(
  spreadsheetId: string
): Promise<gapi.client.sheets.Spreadsheet> {
  const { spreadsheet } = await callPickleSheetApi<{
    spreadsheet: gapi.client.sheets.Spreadsheet;
  }>({ action: 'spreadsheetsGet', spreadsheetId });
  return spreadsheet;
}

export async function batchUpdateSpreadsheet(
  spreadsheetId: string,
  requests: gapi.client.sheets.Request[]
): Promise<gapi.client.sheets.Response[]> {
  const { replies } = await callPickleSheetApi<{
    replies: gapi.client.sheets.Response[];
  }>({
    action: 'batchUpdate',
    spreadsheetId,
    requests,
  });
  return replies ?? [];
}
