import axios from 'axios';
import { toast } from 'react-toastify';
import { supabase } from '../../lib/supabase';
import { useAccessTokenStore } from '../../store/useAccessTokenStore';

let isRefreshing = false;
let pendingCallbacks: ((token: string) => void)[] = [];

async function tryRefreshToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) return null;

  const selectedService = localStorage.getItem('selectedService');
  const isPicknow = selectedService === 'picknow';
  const refreshBaseURL = isPicknow
    ? import.meta.env.VITE_PICKNOW_API_URL
    : import.meta.env.VITE_PROD_API_URL;

  try {
    const res = await axios.post(`${refreshBaseURL}/admin/reissue`, {
      refreshToken,
    });
    const newAccessToken = res.data?.data?.accessToken;
    const newRefreshToken = res.data?.data?.refreshToken;

    if (newAccessToken) {
      useAccessTokenStore.getState().setAccessToken(newAccessToken);
      if (newRefreshToken) localStorage.setItem('refreshToken', newRefreshToken);
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

    // 이미 재시도한 요청이 또 E0123 → 로그아웃
    if ((response.config as unknown as Record<string, unknown>)._refreshed) {
      useAccessTokenStore.getState().clearAccessToken();
      localStorage.removeItem('refreshToken');
      toast.error('로그인이 만료되었습니다. 다시 로그인해주세요.');
      window.location.href = '/';
      return Promise.reject(new Error('인증이 만료되었습니다.'));
    }

    // 다른 요청이 이미 갱신 중이면 완료될 때까지 대기
    if (isRefreshing) {
      return new Promise<typeof response>((resolve) => {
        pendingCallbacks.push((token) => {
          response.config.headers.Authorization = `Bearer ${token}`;
          (response.config as unknown as Record<string, unknown>)._refreshed = true;
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
    useAccessTokenStore.getState().clearAccessToken();
    localStorage.removeItem('refreshToken');
    toast.error('로그인이 만료되었습니다. 다시 로그인해주세요.');
    window.location.href = '/';
    return Promise.reject(new Error('인증이 만료되었습니다.'));
  });

  return instance;
}

export const api = createApiInstance(import.meta.env.VITE_PROD_API_URL);
export const stgApi = createApiInstance(import.meta.env.VITE_STG_API_URL);
export const picknowApi = createApiInstance(import.meta.env.VITE_PICKNOW_API_URL);
