import { supabaseObigoPickle } from '@/lib/supabase';
import type { usingDataProps } from '@/types/pickleProdContents';
import { executeWithConcurrencyLimit } from '@/utils/api/requestPool';

type EpisodeEnv = 'prod' | 'stg';

function getTableName(env: EpisodeEnv): string {
  return env === 'prod' ? 'pickle_episodes_prod' : 'pickle_episodes_stg';
}

async function fetchContentLength(url: string): Promise<number | null> {
  try {
    const res = await fetch(url, { method: 'HEAD' });
    const len = res.headers.get('Content-Length');
    return len ? parseInt(len, 10) : null;
  } catch {
    return null;
  }
}

function fetchFromNetwork(
  url: string,
  timeoutMs = 10000
): Promise<number | null> {
  return new Promise((resolve) => {
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.muted = true;

    const cleanup = () => {
      clearTimeout(timer);
      audio.onloadedmetadata = null;
      audio.onerror = null;
      audio.src = '';
      audio.load();
    };

    const timer = setTimeout(() => {
      cleanup();
      resolve(null);
    }, timeoutMs);

    audio.onloadedmetadata = () => {
      const dur = audio.duration;
      cleanup();
      resolve(isFinite(dur) && dur > 0 ? Math.round(dur) : null);
    };

    audio.onerror = () => {
      cleanup();
      resolve(null);
    };
    audio.src = url;
  });
}

export async function resolveAudioDurationsForSync(
  episodes: usingDataProps[],
  env: EpisodeEnv,
  setProgress?: (msg: string) => void,
  concurrency = 6
): Promise<usingDataProps[]> {
  const targetEpisodes = episodes.filter(
    (ep) => (!ep.playTime || ep.playTime <= 0) && ep.audioUrl
  );
  if (targetEpisodes.length === 0) return episodes;

  const targetIds = targetEpisodes.map((ep) => ep.episodeId);
  const tableName = getTableName(env);

  setProgress?.('자체 DB 캐시 확인 중...');

  const CHUNK_SIZE = 500;
  // duration > 0: 성공한 캐시
  const cacheMap = new Map<number, number>();
  // DB에 존재하는 모든 ID (duration=0 포함) — 재시도 방지용
  const attemptedSet = new Set<number>();

  for (let i = 0; i < targetIds.length; i += CHUNK_SIZE) {
    const chunk = targetIds.slice(i, i + CHUNK_SIZE);
    const { data, error } = await supabaseObigoPickle
      .from(tableName)
      .select('id, duration')
      .in('id', chunk);
    if (error) {
      console.error('Supabase 조회 실패:', error);
      continue;
    }
    data?.forEach((item: { id: number | string; duration: number }) => {
      const id = Number(item.id);
      attemptedSet.add(id);
      if (item.duration > 0) cacheMap.set(id, item.duration);
    });
  }

  // DB에 한 번도 없는 것만 수집 시도
  const realUncached = targetEpisodes.filter(
    (ep) => !attemptedSet.has(ep.episodeId)
  );

  if (realUncached.length > 0) {
    let done = 0;
    setProgress?.(
      `신규 오디오 재생 시간 수집 중... 0 / ${realUncached.length}`
    );

    const upsertBuffer: Array<{
      id: number;
      audio_url: string;
      duration: number;
      file_size: number | null;
      checked_at: string;
    }> = [];

    const tasks = realUncached.map((ep) => async () => {
      const [duration, fileSize] = await Promise.all([
        fetchFromNetwork(ep.audioUrl),
        fetchContentLength(ep.audioUrl),
      ]);
      done += 1;

      const resolvedDuration = duration && duration > 0 ? duration : 0;
      if (resolvedDuration > 0) cacheMap.set(ep.episodeId, resolvedDuration);

      // 성공/실패 모두 DB에 저장 — duration=0이면 "시도했지만 실패"로 기록
      upsertBuffer.push({
        id: ep.episodeId,
        audio_url: ep.audioUrl,
        duration: resolvedDuration,
        file_size: fileSize,
        checked_at: new Date().toISOString(),
      });

      if (done % 5 === 0 || done === realUncached.length) {
        setProgress?.(
          `신규 오디오 재생 시간 수집 중... ${done} / ${realUncached.length}`
        );
      }
    });

    await executeWithConcurrencyLimit(tasks, { concurrency });

    if (upsertBuffer.length > 0) {
      setProgress?.(`자체 DB 캐시 갱신 중... (${upsertBuffer.length}건)`);
      const UPSERT_BATCH_SIZE = 100;
      for (let i = 0; i < upsertBuffer.length; i += UPSERT_BATCH_SIZE) {
        const chunk = upsertBuffer.slice(i, i + UPSERT_BATCH_SIZE);
        const { error } = await supabaseObigoPickle
          .from(tableName)
          .upsert(chunk, { onConflict: 'id' });
        if (error) {
          console.error('Supabase 캐시 갱신 실패:', error);
        }
      }
    }
  }

  return episodes.map((ep) => {
    if (ep.playTime && ep.playTime > 0) return ep;
    const cachedDuration = cacheMap.get(ep.episodeId);
    return cachedDuration ? { ...ep, playTime: cachedDuration } : ep;
  });
}
