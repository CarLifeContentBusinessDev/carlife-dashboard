import type { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';
import { getAuth, isAllowedOrigin } from './getGoogleAuth.js';

type SheetRequestBody =
  | { action: 'valuesGet'; spreadsheetId: string; range: string }
  | {
      action: 'valuesUpdate';
      spreadsheetId: string;
      range: string;
      valueInputOption: 'RAW' | 'USER_ENTERED';
      values: (string | number | undefined)[][];
    }
  | {
      action: 'valuesAppend';
      spreadsheetId: string;
      range: string;
      valueInputOption: 'RAW' | 'USER_ENTERED';
      values: (string | number | undefined)[][];
    }
  | { action: 'valuesClear'; spreadsheetId: string; range: string }
  | { action: 'spreadsheetsGet'; spreadsheetId: string }
  | {
      action: 'batchUpdate';
      spreadsheetId: string;
      requests: object[];
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

    switch (body.action) {
      case 'valuesGet': {
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: body.spreadsheetId,
          range: body.range,
        });
        res.status(200).json({ values: response.data.values ?? [] });
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
      case 'valuesAppend': {
        await sheets.spreadsheets.values.append({
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
        const response = await sheets.spreadsheets.get({
          spreadsheetId: body.spreadsheetId,
        });
        res.status(200).json({ spreadsheet: response.data });
        return;
      }
      case 'batchUpdate': {
        const response = await sheets.spreadsheets.batchUpdate({
          spreadsheetId: body.spreadsheetId,
          requestBody: { requests: body.requests },
        });
        res.status(200).json({ replies: response.data.replies ?? [] });
        return;
      }
      default:
        res.status(400).json({ error: 'Invalid action' });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : '알 수 없는 오류';
    console.error('[pickle-sheet] error: ', err);
    res.status(500).json({ error: message });
  }
}
