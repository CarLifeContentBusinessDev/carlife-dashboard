import axios from 'axios';
import { toast } from 'react-toastify';
import type { PicknowServer, PickleServer } from '@/constants/servers';
import {
  picknowTokenKey,
  picknowRefreshKey,
  pickleTokenKey,
  pickleRefreshKey,
  PICKLE_SERVERS,
  PICKNOW_SERVERS,
} from '@/constants/servers';

let isTestMode = false;

export function setTestMode(value: boolean) {
  isTestMode = value;
}

export function setGoogleLoginInProgress(_value: boolean) {}

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
          import('@/shared/store/usePickleServerStore').then(
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
  import('@/shared/store/usePickleServerStore').then(
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
          import('@/shared/store/usePicknowServerStore').then(
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
  import('@/shared/store/usePicknowServerStore').then(
    ({ usePicknowServerStore }) => {
      usePicknowServerStore.getState().clearServerToken(server.id);
    }
  );
  toast.error(`${server.label} 로그인이 만료되었습니다. 다시 로그인해주세요.`);
}

export const picknowApi = getPicknowServerApi(PICKNOW_SERVERS[0]);
