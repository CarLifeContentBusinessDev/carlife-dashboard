import type { VercelRequest } from '@vercel/node';
import { google } from 'googleapis';

export function getAuth() {
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

export function isAllowedOrigin(req: VercelRequest): boolean {
  const host = req.headers.host;
  const originHeader = req.headers.origin ?? req.headers.referer;
  if (!host || !originHeader) return false;

  try {
    return new URL(originHeader).host === host;
  } catch {
    return false;
  }
}
