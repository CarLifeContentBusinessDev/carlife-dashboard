import axios from 'axios';
import { toast } from 'react-toastify';
import { supabase } from '../../lib/supabase';
import { useAccessTokenStore } from '../../store/useAccessTokenStore';
import type { PicknowServer, PickleServer } from '../../constants/servers';
import {
  picknowTokenKey,
  picknowRefreshKey,
  pickleTokenKey,
  pickleRefreshKey,
  PICKLE_SERVERS,
  PICKNOW_SERVERS,
} from '../../constants/servers';

let isRefreshing = false;
let pendingCallbacks: ((token: string) => void)[] = [];
let isGoogleLoginInProgress = false;
let pendingLogout = false;
let isTestMode = false;
const LOGOUT_EVENT_NAME = 'app:logout';

export function setTestMode(value: boolean) {
  isTestMode = value;
}

function doLogout() {
  isTestMode = false;
  const selectedService = localStorage.getItem('selectedService');
  if (selectedService) {
    localStorage.removeItem(
      selectedService === 'picknow' ? 'picknowToken' : 'pickleToken'
    );
  }
  localStorage.removeItem('refreshToken');
  useAccessTokenStore.getState().clearAccessToken();
  toast.error('로그인이 만료되었습니다. 다시 로그인해주세요.');
  window.dispatchEvent(new Event(LOGOUT_EVENT_NAME));
}

function triggerLogoutRedirect() {
  if (isTestMode) return;
  if (isGoogleLoginInProgress) {
    pendingLogout = true;
    return;
  }
  doLogout();
}

export function setGoogleLoginInProgress(value: boolean) {
  isGoogleLoginInProgress = value;
  if (!value && pendingLogout) {
    pendingLogout = false;
    doLogout();
  }
}

async function tryRefreshToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) return null;

  const selectedService = localStorage.getItem('selectedService');
  const isPicknow = selectedService === 'picknow';
  const refreshBaseURL = isPicknow
    ? import.meta.env.VITE_PICKNOW_API_URL_STG
    : import.meta.env.VITE_PROD_API_URL;

  try {
    const res = await axios.post(`${refreshBaseURL}/admin/reissue`, {
      refreshToken,
    });
    const newAccessToken = res.data?.data?.accessToken;
    const newRefreshToken = res.data?.data?.refreshToken;

    if (newAccessToken) {
      useAccessTokenStore.getState().setAccessToken(newAccessToken);
      if (newRefreshToken)
        localStorage.setItem('refreshToken', newRefreshToken);
      return newAccessToken;
    }
  } catch {
    localStorage.removeItem('refreshToken');
  }

  // Pickle만 Supabase 세션으로 폴백 (Picknow는 Supabase 미사용)
  if (!isPicknow) {
    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token) {
      useAccessTokenStore.getState().setAccessToken(data.session.access_token);
      localStorage.removeItem('refreshToken');
      return data.session.access_token;
    }
  }

  return null;
}

function createApiInstance(baseURL: string) {
  const instance = axios.create({ baseURL });

  instance.interceptors.request.use(
    (config) => {
      const accessToken = localStorage.getItem('accessToken');
      if (accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`;
        (config as unknown as Record<string, unknown>)._hadAuth = true;
      }
      return config;
    },
    (error) => Promise.reject(error)
  );

  instance.interceptors.response.use(async (response) => {
    const { resultCode } = response.data;

    if (resultCode !== 'E0123') {
      return response;
    }

    // 인증 없이 보낸 요청(미로그인 상태)은 만료 처리 없이 그대로 반환
    if (!(response.config as unknown as Record<string, unknown>)._hadAuth) {
      return response;
    }

    // 이미 재시도한 요청이 또 E0123 → 로그아웃
    if ((response.config as unknown as Record<string, unknown>)._refreshed) {
      triggerLogoutRedirect();
      return Promise.reject(new Error('인증이 만료되었습니다.'));
    }

    // 다른 요청이 이미 갱신 중이면 완료될 때까지 대기
    if (isRefreshing) {
      return new Promise<typeof response>((resolve) => {
        pendingCallbacks.push((token) => {
          response.config.headers.Authorization = `Bearer ${token}`;
          (response.config as unknown as Record<string, unknown>)._refreshed =
            true;
          resolve(instance(response.config));
        });
      });
    }

    isRefreshing = true;
    let newToken: string | null = null;

    try {
      newToken = await tryRefreshToken();
    } finally {
      isRefreshing = false;
    }

    if (newToken) {
      pendingCallbacks.forEach((cb) => cb(newToken!));
      pendingCallbacks = [];
      response.config.headers.Authorization = `Bearer ${newToken}`;
      (response.config as unknown as Record<string, unknown>)._refreshed = true;
      return instance(response.config);
    }

    pendingCallbacks = [];
    triggerLogoutRedirect();
    return Promise.reject(new Error('인증이 만료되었습니다.'));
  });

  return instance;
}

// ── Pickle 다중 서버 지원 ──────────────────────────────────────────────────

const pickleServerApiCache = new Map<string, ReturnType<typeof axios.create>>();

export function getPickleServerApi(server: PickleServer) {
  if (!pickleServerApiCache.has(server.id)) {
    pickleServerApiCache.set(server.id, createPickleServerInstance(server));
  }
  return pickleServerApiCache.get(server.id)!;
}

function createPickleServerInstance(server: PickleServer) {
  let isRefreshingServer = false;
  let pendingServerCallbacks: ((token: string) => void)[] = [];

  const instance = axios.create({ baseURL: server.apiUrl });

  instance.interceptors.request.use(
    (config) => {
      const token = localStorage.getItem(pickleTokenKey(server.id));
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
        (config as unknown as Record<string, unknown>)._hadAuth = true;
      }
      return config;
    },
    (error) => Promise.reject(error)
  );

  instance.interceptors.response.use(async (response) => {
    const { resultCode } = response.data;
    if (resultCode !== 'E0123') return response;

    if (isTestMode) return response;

    if (!(response.config as unknown as Record<string, unknown>)._hadAuth) {
      return response;
    }

    if ((response.config as unknown as Record<string, unknown>)._refreshed) {
      doPickleServerLogout(server);
      return Promise.reject(new Error('인증이 만료되었습니다.'));
    }

    if (isRefreshingServer) {
      return new Promise<typeof response>((resolve) => {
        pendingServerCallbacks.push((token) => {
          response.config.headers.Authorization = `Bearer ${token}`;
          (response.config as unknown as Record<string, unknown>)._refreshed =
            true;
          resolve(instance(response.config));
        });
      });
    }

    isRefreshingServer = true;
    let newToken: string | null = null;

    try {
      const storedRefresh = localStorage.getItem(pickleRefreshKey(server.id));
      if (storedRefresh) {
        const res = await axios.post(`${server.apiUrl}/admin/reissue`, {
          refreshToken: storedRefresh,
        });
        const newAccess = res.data?.data?.accessToken;
        const newRefresh = res.data?.data?.refreshToken;
        if (newAccess) {
          import('../../store/usePickleServerStore').then(
            ({ usePickleServerStore }) => {
              usePickleServerStore
                .getState()
                .setServerToken(server.id, newAccess, newRefresh ?? undefined);
            }
          );
          newToken = newAccess;
        }
      }
    } catch {
      localStorage.removeItem(pickleRefreshKey(server.id));
    } finally {
      isRefreshingServer = false;
    }

    if (newToken) {
      pendingServerCallbacks.forEach((cb) => cb(newToken!));
      pendingServerCallbacks = [];
      response.config.headers.Authorization = `Bearer ${newToken}`;
      (response.config as unknown as Record<string, unknown>)._refreshed = true;
      return instance(response.config);
    }

    pendingServerCallbacks = [];
    doPickleServerLogout(server);
    return Promise.reject(new Error('인증이 만료되었습니다.'));
  });

  return instance;
}

function doPickleServerLogout(server: PickleServer) {
  import('../../store/usePickleServerStore').then(
    ({ usePickleServerStore }) => {
      usePickleServerStore.getState().clearServerToken(server.id);
    }
  );
  toast.error(
    `Pickle ${server.label} 로그인이 만료되었습니다. 다시 로그인해주세요.`
  );
}

export const api = getPickleServerApi(PICKLE_SERVERS[0]);
export const stgApi = getPickleServerApi(PICKLE_SERVERS[1]);

// ── Picknow 다중 서버 지원 ─────────────────────────────────────────────────

const picknowServerApiCache = new Map<
  string,
  ReturnType<typeof axios.create>
>();

export function getPicknowServerApi(server: PicknowServer) {
  if (!picknowServerApiCache.has(server.id)) {
    picknowServerApiCache.set(server.id, createPicknowServerInstance(server));
  }
  return picknowServerApiCache.get(server.id)!;
}

function createPicknowServerInstance(server: PicknowServer) {
  let isRefreshingServer = false;
  let pendingServerCallbacks: ((token: string) => void)[] = [];

  const instance = axios.create({ baseURL: server.apiUrl });

  instance.interceptors.request.use(
    (config) => {
      const token = localStorage.getItem(picknowTokenKey(server.id));
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
        (config as unknown as Record<string, unknown>)._hadAuth = true;
      }
      return config;
    },
    (error) => Promise.reject(error)
  );

  instance.interceptors.response.use(async (response) => {
    const { resultCode } = response.data;
    if (resultCode !== 'E0123') return response;

    if (!(response.config as unknown as Record<string, unknown>)._hadAuth) {
      return response;
    }

    if ((response.config as unknown as Record<string, unknown>)._refreshed) {
      doPicknowServerLogout(server);
      return Promise.reject(new Error('인증이 만료되었습니다.'));
    }

    if (isRefreshingServer) {
      return new Promise<typeof response>((resolve) => {
        pendingServerCallbacks.push((token) => {
          response.config.headers.Authorization = `Bearer ${token}`;
          (response.config as unknown as Record<string, unknown>)._refreshed =
            true;
          resolve(instance(response.config));
        });
      });
    }

    isRefreshingServer = true;
    let newToken: string | null = null;

    try {
      const storedRefresh = localStorage.getItem(picknowRefreshKey(server.id));
      if (storedRefresh) {
        const res = await axios.post(`${server.apiUrl}/admin/reissue`, {
          refreshToken: storedRefresh,
        });
        const newAccess = res.data?.data?.accessToken;
        const newRefresh = res.data?.data?.refreshToken;
        if (newAccess) {
          import('../../store/usePicknowServerStore').then(
            ({ usePicknowServerStore }) => {
              usePicknowServerStore
                .getState()
                .setServerToken(server.id, newAccess, newRefresh ?? undefined);
            }
          );
          newToken = newAccess;
        }
      }
    } catch {
      localStorage.removeItem(picknowRefreshKey(server.id));
    } finally {
      isRefreshingServer = false;
    }

    if (newToken) {
      pendingServerCallbacks.forEach((cb) => cb(newToken!));
      pendingServerCallbacks = [];
      response.config.headers.Authorization = `Bearer ${newToken}`;
      (response.config as unknown as Record<string, unknown>)._refreshed = true;
      return instance(response.config);
    }

    pendingServerCallbacks = [];
    doPicknowServerLogout(server);
    return Promise.reject(new Error('인증이 만료되었습니다.'));
  });

  return instance;
}

function doPicknowServerLogout(server: PicknowServer) {
  // store import를 지연해서 순환 참조 방지
  import('../../store/usePicknowServerStore').then(
    ({ usePicknowServerStore }) => {
      usePicknowServerStore.getState().clearServerToken(server.id);
    }
  );
  toast.error(`${server.label} 로그인이 만료되었습니다. 다시 로그인해주세요.`);
}

export const picknowApi = getPicknowServerApi(PICKNOW_SERVERS[0]);
