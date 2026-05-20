import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { usingChannelProps } from '@/types/pickleProdContents';

const STALE_MS = 30 * 60 * 1000;

type Env = 'prod' | 'stg';

interface ChannelCache {
  data: usingChannelProps[];
  fetchedAt: number;
}

interface ChannelStore {
  cache: Partial<Record<Env, ChannelCache>>;
  setCache: (env: Env, data: usingChannelProps[]) => void;
  isStale: (env: Env) => boolean;
  clearCache: (env?: Env) => void;
}

export const useChannelStore = create<ChannelStore>()(
  persist(
    (set, get) => ({
      cache: {},
      setCache: (env, data) =>
        set((state) => ({
          cache: { ...state.cache, [env]: { data, fetchedAt: Date.now() } },
        })),
      isStale: (env) => {
        const entry = get().cache[env];
        if (!entry) return true;
        return Date.now() - entry.fetchedAt > STALE_MS;
      },
      clearCache: (env) =>
        env
          ? set((state) => ({ cache: { ...state.cache, [env]: undefined } }))
          : set({ cache: {} }),
    }),
    {
      name: 'channel-cache',
      storage: createJSONStorage(() => sessionStorage),
    }
  )
);
