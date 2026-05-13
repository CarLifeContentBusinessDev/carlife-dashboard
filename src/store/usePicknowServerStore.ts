import { create } from 'zustand';
import {
  PICKNOW_SERVERS,
  picknowTokenKey,
  picknowRefreshKey,
} from '../constants/servers';

const SELECTED_SERVERS_KEY = 'picknow_selected_servers';

function loadSelectedServerIds(): string[] {
  try {
    const stored = localStorage.getItem(SELECTED_SERVERS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as unknown;
      if (Array.isArray(parsed) && parsed.length > 0) return parsed as string[];
    }
  } catch {}
  return PICKNOW_SERVERS[0] ? [PICKNOW_SERVERS[0].id] : [];
}

function loadServerTokens(): Record<string, string> {
  const tokens: Record<string, string> = {};
  PICKNOW_SERVERS.forEach((server) => {
    const token = localStorage.getItem(picknowTokenKey(server.id));
    if (token) tokens[server.id] = token;
  });
  return tokens;
}

interface PicknowServerState {
  selectedServerIds: string[];
  serverTokens: Record<string, string>;
  toggleSelectedServer: (id: string) => void;
  setServerToken: (id: string, token: string, refreshToken?: string) => void;
  clearServerToken: (id: string) => void;
  isServerLoggedIn: (id: string) => boolean;
  getServerToken: (id: string) => string | null;
}

export const usePicknowServerStore = create<PicknowServerState>()((set, get) => ({
  selectedServerIds: loadSelectedServerIds(),
  serverTokens: loadServerTokens(),

  toggleSelectedServer: (id) => {
    set((state) => {
      const newIds = state.selectedServerIds.includes(id)
        ? state.selectedServerIds.filter((i) => i !== id)
        : [...state.selectedServerIds, id];
      localStorage.setItem(SELECTED_SERVERS_KEY, JSON.stringify(newIds));
      return { selectedServerIds: newIds };
    });
  },

  setServerToken: (id, token, refreshToken) => {
    localStorage.setItem(picknowTokenKey(id), token);
    if (refreshToken) localStorage.setItem(picknowRefreshKey(id), refreshToken);
    set((state) => ({ serverTokens: { ...state.serverTokens, [id]: token } }));
  },

  clearServerToken: (id) => {
    localStorage.removeItem(picknowTokenKey(id));
    localStorage.removeItem(picknowRefreshKey(id));
    set((state) => {
      const next = { ...state.serverTokens };
      delete next[id];
      return { serverTokens: next };
    });
  },

  isServerLoggedIn: (id) => !!get().serverTokens[id],
  getServerToken: (id) => get().serverTokens[id] ?? null,
}));
