import { create } from 'zustand';
import {
  PICKSERIES_SERVERS,
  pickSeriesTokenKey,
  pickSeriesRefreshKey,
} from '@/constants/servers';
import { isJwtExpired } from '@/shared/utils/jwt';

function loadServerTokens(): Record<string, string> {
  const tokens: Record<string, string> = {};
  PICKSERIES_SERVERS.forEach((server) => {
    const token = localStorage.getItem(pickSeriesTokenKey(server.id));

    if (token) {
      if (isJwtExpired(token)) {
        localStorage.removeItem(pickSeriesTokenKey(server.id));
        localStorage.removeItem(pickSeriesRefreshKey(server.id));
        return;
      }
      tokens[server.id] = token;
    }
  });
  return tokens;
}

interface PickSeriesServerState {
  serverTokens: Record<string, string>;
  setServerToken: (id: string, token: string, refreshToken?: string) => void;
  clearServerToken: (id: string) => void;
  isServerLoggedIn: (id: string) => boolean;
  getServerToken: (id: string) => string | null;
}

export const usePickSeriesServerStore = create<PickSeriesServerState>()(
  (set, get) => ({
    serverTokens: loadServerTokens(),

    setServerToken: (id, token, refreshToken) => {
      localStorage.setItem(pickSeriesTokenKey(id), token);
      if (refreshToken)
        localStorage.setItem(pickSeriesRefreshKey(id), refreshToken);
      set((state) => ({
        serverTokens: { ...state.serverTokens, [id]: token },
      }));
    },

    clearServerToken: (id) => {
      localStorage.removeItem(pickSeriesTokenKey(id));
      localStorage.removeItem(pickSeriesRefreshKey(id));
      set((state) => {
        const next = { ...state.serverTokens };
        delete next[id];
        return { serverTokens: next };
      });
    },

    isServerLoggedIn(id) {
      const token = get().serverTokens[id];
      return !!token && !isJwtExpired(token);
    },
    getServerToken: (id) => get().serverTokens[id] ?? null,
  })
);
