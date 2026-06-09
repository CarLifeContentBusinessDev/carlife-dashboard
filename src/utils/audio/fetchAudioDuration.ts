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
  cache[url] = { duration, cachedAt: Date.now() };
  writeCache(cache);
}

function getCachedDuration(url: string): number | null {
  if (!url) return null;
  const entry = readCache()[url];
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > CACHE_TTL_MS) return null;
  return entry.duration;
}

export function enrichEpisodesWithAudioDuration(
  episodes: usingDataProps[]
): usingDataProps[] {
  return episodes.map((ep) => {
    if (ep.playTime && ep.playTime > 0) return ep;
    const cached = getCachedDuration(ep.audioUrl);
    if (cached === null) return ep;
    return { ...ep, playTime: cached };
  });
}
