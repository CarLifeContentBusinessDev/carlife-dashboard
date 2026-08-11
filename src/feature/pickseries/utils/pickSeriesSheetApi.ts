export async function getSheetValues(
  spreadsheetId: string,
  range: string
): Promise<string[][]> {
  const res = await fetch('/api/pickseries-sheet', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'get', spreadsheetId, range }),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error ?? '시트를 불러오지 못했습니다.');
  }
  return (json.values ?? []) as string[][];
}

export async function batchUpdateSheetValues(
  spreadsheetId: string,
  data: Array<{ range: string; values: (string | number)[][] }>
): Promise<void> {
  const res = await fetch('/api/pickseries-sheet', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'batchUpdate', spreadsheetId, data }),
  });

  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error ?? '시트에 쓰지 못했습니다.');
  }
}
