import { useLoginTokenStore } from '@/shared/store/useLoginTokenStore';
import { setGoogleLoginInProgress } from '@/shared/utils/api/api';

// gapi 클라이언트 에러는 unknown으로 들어오므로, 상태 코드/메시지를 안전하게 꺼내는 헬퍼
export function getGoogleApiErrorStatus(err: unknown): number | undefined {
  if (typeof err === 'object' && err !== null && 'status' in err) {
    const status = (err as { status?: unknown }).status;
    return typeof status === 'number' ? status : undefined;
  }
  return undefined;
}

export function getGoogleApiErrorMessage(err: unknown): string {
  if (typeof err === 'object' && err !== null && 'result' in err) {
    const result = (err as { result?: { error?: { message?: unknown } } })
      .result;
    if (typeof result?.error?.message === 'string') return result.error.message;
  }
  return '알 수 없는 오류';
}

// Google OAuth 설정
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';

let tokenClient: google.accounts.oauth2.TokenClient | null = null;
let gapiInited = false;
let gapiInitPromise: Promise<void> | null = null;
let gisInited = false;
let gisInitPromise: Promise<void> | null = null;
let silentRefreshPromise: Promise<string | null> | null = null;

const clearSavedGoogleToken = () => {
  localStorage.removeItem('googleAccessToken');
  useLoginTokenStore.getState().clearLoginToken();
};

// Google API 클라이언트 초기화
export function initializeGoogleAPI(): Promise<void> {
  if (gapiInited) {
    return Promise.resolve();
  }

  if (gapiInitPromise) {
    return gapiInitPromise;
  }

  gapiInitPromise = new Promise((resolve, reject) => {
    // gapi 스크립트 로드
    const gapiScript = document.createElement('script');

    gapiScript.src = 'https://apis.google.com/js/api.js';
    gapiScript.async = true;
    gapiScript.defer = true;

    gapiScript.onload = () => {
      gapi.load('client', async () => {
        try {
          await gapi.client.init({
            apiKey: GOOGLE_API_KEY,

            discoveryDocs: [
              'https://sheets.googleapis.com/$discovery/rest?version=v4',
            ],
          });

          gapiInited = true;
          console.log('Google API 초기화 완료');
          resolve();
        } catch (error) {
          gapiInitPromise = null;
          console.error('Google API 초기화 실패:', error);
          reject(error);
        }
      });
    };

    gapiScript.onerror = () => {
      gapiInitPromise = null;
      reject(new Error('Google API 스크립트 로드 실패'));
    };
    document.body.appendChild(gapiScript);
  });

  return gapiInitPromise;
}

// Google Identity Services 초기화
export function initializeGIS(): Promise<void> {
  if (gisInited) {
    return Promise.resolve();
  }

  if (gisInitPromise) {
    return gisInitPromise;
  }

  gisInitPromise = new Promise((resolve, reject) => {
    // GIS 스크립트 로드
    const gisScript = document.createElement('script');

    gisScript.src = 'https://accounts.google.com/gsi/client';
    gisScript.async = true;
    gisScript.defer = true;
    gisScript.onload = () => {
      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: SCOPES,
        callback: '', // 나중에 설정
      });

      gisInited = true;
      console.log('Google Identity Services 초기화 완료');
      resolve();
    };

    gisScript.onerror = () => {
      gisInitPromise = null;
      reject(new Error('GIS 스크립트 로드 실패'));
    };

    document.body.appendChild(gisScript);
  });

  return gisInitPromise;
}

// Google 인증 토큰 획득
export async function getGoogleToken(): Promise<string | null> {
  try {
    // 초기화 확인
    if (!gapiInited) {
      await initializeGoogleAPI();
    }
    if (!gisInited) {
      await initializeGIS();
    }

    // 기존 토큰 확인 및 유효성 검증
    const existingToken = localStorage.getItem('googleAccessToken');

    if (existingToken) {
      // gapi에 토큰 설정
      gapi.client.setToken({ access_token: existingToken });
      try {
        // 토큰이 유효한지 간단한 API 호출로 테스트
        await gapi.client.sheets.spreadsheets.get({
          spreadsheetId: import.meta.env.VITE_SPREADSHEET_ID,
        });

        // 토큰이 유효하면 그대로 반환
        return existingToken;
      } catch (error: unknown) {
        // 401 에러면 토큰이 만료됨
        if (getGoogleApiErrorStatus(error) === 401) {
          console.log('토큰이 만료되어 새로 요청합니다');
          clearSavedGoogleToken();
          gapi.client.setToken(null);
        } else {
          // 다른 에러면 토큰은 유효하므로 그대로 반환
          return existingToken;
        }
      }
    }

    // 새 토큰 요청 (사용자가 명시적으로 로그인 버튼을 클릭한 경우에만 실행됨)
    return new Promise((resolve, reject) => {
      if (!tokenClient) {
        reject(new Error('Token client가 초기화되지 않았습니다'));
        return;
      }

      tokenClient.callback = (
        response: google.accounts.oauth2.TokenResponse
      ) => {
        setGoogleLoginInProgress(false);

        if (response.error) {
          console.error('Google 인증 실패:', response);
          clearSavedGoogleToken();
          reject(new Error(response.error));
          return;
        }

        // 토큰 저장
        const token = response.access_token;
        localStorage.setItem('googleAccessToken', token);
        useLoginTokenStore.getState().setLoginToken(token);
        gapi.client.setToken({ access_token: token });
        resolve(token);
      };

      // 팝업이 열리는 동안 Pickle API 에러로 인한 강제 로그아웃 방지
      setGoogleLoginInProgress(true);
      tokenClient.requestAccessToken({});
    });
  } catch (error) {
    setGoogleLoginInProgress(false);
    console.error('Google 인증 실패:', error);

    clearSavedGoogleToken();

    return null;
  }
}

// 팝업 없이 Google 토큰 재발급 시도 (사용자 Google 세션이 살아있을 때만 성공)
export function silentRefreshGoogleToken(): Promise<string | null> {
  if (silentRefreshPromise) return silentRefreshPromise;

  silentRefreshPromise = new Promise<string | null>((resolve) => {
    if (!tokenClient || !gisInited) {
      silentRefreshPromise = null;
      resolve(null);
      return;
    }

    tokenClient.callback = (response: google.accounts.oauth2.TokenResponse) => {
      silentRefreshPromise = null;

      if (response.error) {
        clearSavedGoogleToken();
        resolve(null);
        return;
      }

      const token = response.access_token;
      localStorage.setItem('googleAccessToken', token);
      useLoginTokenStore.getState().setLoginToken(token);
      gapi.client.setToken({ access_token: token });
      resolve(token);
    };

    tokenClient.requestAccessToken({ prompt: 'none' });
  });

  return silentRefreshPromise;
}

// Google 로그아웃
export function googleLogout() {
  const token = gapi.client.getToken();

  if (token !== null) {
    google.accounts.oauth2.revoke(token.access_token, () => {
      console.log('Google 로그아웃 완료');
    });

    gapi.client.setToken(null);
  }

  clearSavedGoogleToken();
}

// Google Sheets API 클라이언트 가져오기
export function getSheetsClient() {
  if (!gapiInited) {
    throw new Error('Google API가 초기화되지 않았습니다');
  }

  return gapi.client.sheets;
}
