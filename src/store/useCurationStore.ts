import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { ProdCurationRow } from '@/types/pickleProdContents';

const STALE_MS = 30 * 60 * 1000;

type Env = 'prod' | 'stg';

interface CurationCache {
  data: ProdCurationRow[];
  fetchedAt: number;
}

interface CurationStore {
  cache: Partial<Record<Env, CurationCache>>;
  setCache: (env: Env, data: ProdCurationRow[]) => void;
  isStale: (env: Env) => boolean;
  clearCache: (env?: Env) => void;
}

export const useCurationStore = create<CurationStore>()(
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
      name: 'curation-cache',
      storage: createJSONStorage(() => sessionStorage),
    }
  )
);
