import { create } from 'zustand';
import { PICKLE_SERVERS, pickleTokenKey, pickleRefreshKey } from '../constants/servers';

function loadServerTokens(): Record<string, string> {
  const tokens: Record<string, string> = {};
  PICKLE_SERVERS.forEach((server) => {
    const token = localStorage.getItem(pickleTokenKey(server.id));
    if (token) tokens[server.id] = token;
  });
  return tokens;
}

interface PickleServerState {
  serverTokens: Record<string, string>;
  setServerToken: (id: string, token: string, refreshToken?: string) => void;
  clearServerToken: (id: string) => void;
  isServerLoggedIn: (id: string) => boolean;
  getServerToken: (id: string) => string | null;
}

export const usePickleServerStore = create<PickleServerState>()((set, get) => ({
  serverTokens: loadServerTokens(),

  setServerToken: (id, token, refreshToken) => {
    localStorage.setItem(pickleTokenKey(id), token);
    if (refreshToken) localStorage.setItem(pickleRefreshKey(id), refreshToken);
    set((state) => ({ serverTokens: { ...state.serverTokens, [id]: token } }));
  },

  clearServerToken: (id) => {
    localStorage.removeItem(pickleTokenKey(id));
    localStorage.removeItem(pickleRefreshKey(id));
    set((state) => {
      const next = { ...state.serverTokens };
      delete next[id];
      return { serverTokens: next };
    });
  },

  isServerLoggedIn: (id) => !!get().serverTokens[id],
  getServerToken: (id) => get().serverTokens[id] ?? null,
}));
