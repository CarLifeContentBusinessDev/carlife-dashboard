import type { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';

type SheetRequestBody =
  | { action: 'valuesGet'; spreadsheetId: string; range: string }
  | {
      action: 'valuesUpdate';
      spreadsheetId: string;
      range: string;
      valueInputOption: 'RAW' | 'USER_ENTERED';
      values: (string | number)[][];
    }
  | { action: 'valuesClear'; spreadsheetId: string; range: string }
  | { action: 'spreadsheetsGet'; spreadsheetId: string }
  | {
      action: 'batchUpdate';
      spreadsheetId: string;
      requests: object[];
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

    switch (body.action) {
      case 'valuesGet': {
        const r = await sheets.spreadsheets.values.get({
          spreadsheetId: body.spreadsheetId,
          range: body.range,
        });
        res.status(200).json({ values: r.data.values ?? [] });
        return;
      }
      case 'valuesUpdate': {
        await sheets.spreadsheets.values.update({
          spreadsheetId: body.spreadsheetId,
          range: body.range,
          valueInputOption: body.valueInputOption,
          requestBody: { values: body.values },
        });
        res.status(200).json({ ok: true });
        return;
      }
      case 'valuesClear': {
        await sheets.spreadsheets.values.clear({
          spreadsheetId: body.spreadsheetId,
          range: body.range,
        });
        res.status(200).json({ ok: true });
        return;
      }
      case 'spreadsheetsGet': {
        const r = await sheets.spreadsheets.get({
          spreadsheetId: body.spreadsheetId,
        });
        res.status(200).json({ spreadsheet: r.data });
        return;
      }
      case 'batchUpdate': {
        const r = await sheets.spreadsheets.batchUpdate({
          spreadsheetId: body.spreadsheetId,
          requestBody: { requests: body.requests },
        });
        res.status(200).json({ replies: r.data.replies ?? [] });
        return;
      }
      default:
        res.status(400).json({ error: 'Invalid action' });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : '알 수 없는 오류';
    console.error('[picknow-sheet] error: ', err);
    res.status(500).json({ error: message });
  }
}
