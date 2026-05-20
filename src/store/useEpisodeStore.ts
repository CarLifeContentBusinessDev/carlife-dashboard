import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { usingDataProps } from '@/types/pickleProdContents';

const STALE_MS = 30 * 60 * 1000;

type EpisodeEnv = 'prod' | 'stg';

interface EpisodeCache {
  data: usingDataProps[];
  fetchedAt: number;
}

interface EpisodeStore {
  cache: Partial<Record<EpisodeEnv, EpisodeCache>>;
  setCache: (env: EpisodeEnv, data: usingDataProps[]) => void;
  isStale: (env: EpisodeEnv) => boolean;
  clearCache: (env?: EpisodeEnv) => void;
}

export const useEpisodeStore = create<EpisodeStore>()(
  persist(
    (set, get) => ({
      cache: {},
      setCache: (env, data) =>
        set((state) => ({
          cache: { ...state.cache, [env]: { data, fetchedAt: Date.now() } },
        })),
      isStale: (env) => {
        const entry = get().cache[env];
        if (!entry || entry.data.length === 0) return true;
        return Date.now() - entry.fetchedAt > STALE_MS;
      },
      clearCache: (env) =>
        env
          ? set((state) => ({ cache: { ...state.cache, [env]: undefined } }))
          : set({ cache: {} }),
    }),
    {
      name: 'episode-cache',
      storage: createJSONStorage(() => sessionStorage),
    }
  )
);
