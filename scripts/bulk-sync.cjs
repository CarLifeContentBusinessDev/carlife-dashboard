// scripts/bulk-sync.cjs
// 사용법: node scripts/bulk-sync.cjs [prod|stg]
// 전제: scripts/all_episodes.json 파일이 먼저 준비되어 있어야 합니다.

require('dotenv').config({
  path: require('path').resolve(__dirname, '../.env'),
});
const axios = require('axios');
const mm = require('music-metadata');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// ─── 설정 ──────────────────────────────────────────────────────────────────────
const ENV = process.argv[2] === 'stg' ? 'stg' : 'prod';
const TABLE_NAME = `pickle_episodes_${ENV}`;
const CONCURRENCY = 80;
const UPSERT_BATCH_SIZE = 100;

// obigopickle's Supabase — service_role 키로 RLS 우회 (스크립트 전용)
const SUPABASE_URL = process.env.VITE_SUPABASE_URL_PROD;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY_PROD;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    '❌ .env에 VITE_SUPABASE_URL_PROD, VITE_SUPABASE_ANON_KEY_PROD 를 설정해주세요.'
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
// ────────────────────────────────────────────────────────────────────────────────

const jsonPath = path.join(__dirname, 'all_episodes.json');
if (!fs.existsSync(jsonPath)) {
  console.error(
    '❌ all_episodes.json 파일이 없습니다. 브라우저 콘솔에서 먼저 추출해주세요.'
  );
  process.exit(1);
}

const allEpisodes = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const targets = allEpisodes.filter(
  (ep) => (!ep.playTime || ep.playTime <= 0) && ep.audioUrl
);

async function fetchMetadata(url) {
  try {
    const res = await axios.get(url, {
      responseType: 'stream',
      timeout: 8000,
    });

    const fileSize = res.headers['content-length']
      ? parseInt(res.headers['content-length'], 10)
      : null;

    const metadata = await mm.parseStream(res.data, {
      mimeType: res.headers['content-type'],
      duration: true,
    });

    res.data.destroy();

    const duration = metadata.format?.duration
      ? Math.round(metadata.format.duration)
      : null;

    return { duration, fileSize };
  } catch {
    return { duration: null, fileSize: null };
  }
}

async function start() {
  const total = targets.length;
  console.log(
    `🚀 [${ENV.toUpperCase()}] 총 ${total}개 오디오 수집 시작 (concurrency: ${CONCURRENCY})`
  );
  console.log(`📋 테이블: ${TABLE_NAME}\n`);

  const queue = [...targets];
  let completed = 0;
  let saved = 0;
  let buffer = [];

  async function flushBuffer() {
    if (buffer.length === 0) return;
    const toUpsert = [...buffer];
    buffer = [];
    const { error } = await supabase
      .from(TABLE_NAME)
      .upsert(toUpsert, { onConflict: 'id' });
    if (error) {
      console.error('  ⚠️  Supabase upsert 실패:', error.message);
    } else {
      saved += toUpsert.length;
    }
  }

  async function worker() {
    while (queue.length > 0) {
      const ep = queue.shift();
      if (!ep) continue;

      const { duration, fileSize } = await fetchMetadata(ep.audioUrl);

      if (duration && duration > 0) {
        buffer.push({
          id: ep.episodeId,
          audio_url: ep.audioUrl,
          duration,
          file_size: fileSize,
          checked_at: new Date().toISOString(),
        });
      }

      completed++;

      if (buffer.length >= UPSERT_BATCH_SIZE || completed === total) {
        await flushBuffer();
      }

      if (completed % 100 === 0 || completed === total) {
        const pct = ((completed / total) * 100).toFixed(1);
        console.log(
          `  ⏳ ${completed}/${total} (${pct}%) — DB 저장: ${saved}개`
        );
      }
    }
  }

  const startTime = Date.now();
  const workers = Array(Math.min(CONCURRENCY, total)).fill(null).map(worker);
  await Promise.all(workers);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(
    `\n✅ 완료! ${total}개 중 ${saved}개 DB 저장 (소요: ${elapsed}초)`
  );
  console.log('   이제 브라우저 동기화는 캐시에서 바로 읽습니다.');
}

start().catch((err) => {
  console.error('스크립트 실행 오류:', err);
  process.exit(1);
});
