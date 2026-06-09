import type { usingDataProps } from '@/types/pickleProdContents';

const CACHE_KEY = 'pickle_audio_duration_cache';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7일

interface CacheEntry {
  duration: number;
  cachedAt: number;
}

function readCache(): Record<string, CacheEntry> {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function writeCache(cache: Record<string, CacheEntry>): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // localStorage 용량 초과 시 무시
  }
}

/** 상세 페이지에서 오디오 메타데이터 로드 성공 시 호출 */
export function saveAudioDurationToCache(url: string, duration: number): void {
  if (!url || duration <= 0) return;
  const cache = readCache();
  const now = Date.now();
  const cleanCache: Record<string, CacheEntry> = {};
  for (const [key, entry] of Object.entries(cache)) {
    if (now - entry.cachedAt <= CACHE_TTL_MS) {
      cleanCache[key] = entry;
    }
  }
  cache[url] = { duration, cachedAt: Date.now() };
  writeCache(cleanCache);
}

function getCachedDuration(url: string): number | null {
  if (!url) return null;
  const entry = readCache()[url];
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > CACHE_TTL_MS) return null;
  return entry.duration;
}

function fetchFromNetwork(
  url: string,
  timeoutMs = 10000
): Promise<number | null> {
  return new Promise((resolve) => {
    const audio = new Audio();
    audio.preload = 'metadata';

    const timer = setTimeout(() => {
      audio.src = '';
      resolve(null);
    }, timeoutMs);

    audio.onloadedmetadata = () => {
      clearTimeout(timer);
      const dur = audio.duration;
      audio.src = '';
      const result = isFinite(dur) && dur > 0 ? Math.round(dur) : null;
      if (result !== null) saveAudioDurationToCache(url, result);
      resolve(result);
    };

    audio.onerror = () => {
      clearTimeout(timer);
      audio.src = '';
      resolve(null);
    };

    audio.src = url;
  });
}

export function warmAudioDurationCache(
  episodes: usingDataProps[],
  concurrency = 5
): () => void {
  const targets = episodes.filter(
    (ep) =>
      ep.audioUrl &&
      (!ep.playTime || ep.playTime <= 0) &&
      getCachedDuration(ep.audioUrl) === null
  );

  if (targets.length === 0) return () => {};

  let cancelled = false;

  (async () => {
    for (let i = 0; i < targets.length; i += concurrency) {
      if (cancelled) break;
      const batch = targets.slice(i, i + concurrency);
      await Promise.all(batch.map((ep) => fetchFromNetwork(ep.audioUrl)));
    }
  })();

  return () => {
    cancelled = true;
  };
}

export function enrichEpisodesWithAudioDuration(
  episodes: usingDataProps[]
): usingDataProps[] {
  const cache = readCache();
  const now = Date.now();
  return episodes.map((ep) => {
    if (ep.playTime && ep.playTime > 0) return ep;
    if (!ep.audioUrl) return ep;
    const entry = cache[ep.audioUrl];
    if (!entry) return ep;
    if (now - entry.cachedAt > CACHE_TTL_MS) return ep;
    return { ...ep, playTime: entry.duration };
  });
}
