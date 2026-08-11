import type { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';
import { getAuth, isAllowedOrigin } from './getGoogleAuth';

type SheetRequestBody =
  | { action: 'get'; spreadsheetId: string; range: string }
  | {
      action: 'batchUpdate';
      spreadsheetId: string;
      data: Array<{ range: string; values: (string | number)[][] }>;
    };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!isAllowedOrigin(req)) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const body = req.body as SheetRequestBody;

  try {
    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    if (body.action === 'get') {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: body.spreadsheetId,
        range: body.range,
      });
      res.status(200).json({ values: response.data.values ?? [] });
      return;
    }

    if (body.action === 'batchUpdate') {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: body.spreadsheetId,
        requestBody: { valueInputOption: 'USER_ENTERED', data: body.data },
      });
      res.status(200).json({ ok: true });
      return;
    }

    res.status(400).json({ error: 'Unknown action' });
  } catch (err) {
    const message = err instanceof Error ? err.message : '알 수 없는 오류';
    console.error('[pickseries-sheet] error:', err);
    res.status(500).json({ error: message });
  }
}
