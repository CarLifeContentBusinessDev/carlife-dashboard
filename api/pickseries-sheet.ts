import type { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';

type SheetRequestBody =
  | { action: 'get'; spreadsheetId: string; range: string }
  | {
      action: 'batchUpdate';
      spreadsheetId: string;
      data: Array<{ range: string; values: (string | number)[][] }>;
    };

function getAuth() {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(
    /^"(.*)"$/,
    '$1'
  )?.replace(/\\n/g, '\n');

  if (!clientEmail || !privateKey) {
    throw new Error(
      'GOOGLE_CLIENT_EMAIL / GOOGLE_PRIVATE_KEY 환경변수가 설정되지 않았습니다.'
    );
  }

  return new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

function isAllowedOrigin(req: VercelRequest): boolean {
  const host = req.headers.host;
  const originHeader = req.headers.origin ?? req.headers.referer;
  if (!host || !originHeader) return false;

  try {
    return new URL(originHeader).host === host;
  } catch {
    return false;
  }
}

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
