import type { AxiosInstance } from 'axios';
import * as XLSX from 'xlsx';
import type { PickjoyOEMParams } from './pickjoyOEMConfig';

type DateRange = { startDate: string; endDate: string };
type DailyStat = Record<string, number>;

function sumDaily(stats: DailyStat[], key: string): number {
  return stats.reduce((sum, day) => sum + (Number(day[key]) || 0), 0);
}

export async function fetchRegisteredVinCount(
  api: AxiosInstance,
  range: DateRange
): Promise<number> {
  const res = await api.get<{
    data: { dailyWeeklyMonthlyStatistics: DailyStat[] };
  }>('/api/admin/v1/statistics/user-status', {
    params: { statisticsSearchType: 'DAILY', ...range },
  });
  return sumDaily(res.data.data.dailyWeeklyMonthlyStatistics, 'registeredVinCount');
}

export async function fetchServiceStats(
  api: AxiosInstance,
  range: DateRange
): Promise<{ wau: number; totalClicks: number }> {
  const res = await api.get<{
    data: { dailyWeeklyMonthlyStatistics: DailyStat[] };
  }>('/api/admin/v1/statistics/service-status', {
    params: { statisticsSearchType: 'DAILY', ...range },
  });
  const stats = res.data.data.dailyWeeklyMonthlyStatistics;
  return {
    wau: sumDaily(stats, 'firstRunCount'),
    totalClicks: sumDaily(stats, 'gameListPageAccessCount'),
  };
}

export async function fetchContentsStats(
  api: AxiosInstance,
  range: DateRange
): Promise<{ contentClicks: number; contentPlayTime: number }> {
  const res = await api.get<{
    data: { dailyWeeklyMonthlyStatistics: DailyStat[] };
  }>('/api/admin/v1/statistics/contents-status', {
    params: { statisticsSearchType: 'DAILY', ...range },
  });
  const stats = res.data.data.dailyWeeklyMonthlyStatistics;
  return {
    contentClicks: sumDaily(stats, 'gameRunCount'),
    contentPlayTime: sumDaily(stats, 'totalGamePlayTime'),
  };
}

// OEM 지표용: 단일 OEM 기준 인기 콘텐츠
export async function fetchTopContent(
  api: AxiosInstance,
  range: DateRange,
  oemParams: PickjoyOEMParams
): Promise<string> {
  const res = await api.get('/api/admin/v1/statistics/export', {
    params: { statisticsSearchType: 'DAILY', ...range, ...oemParams },
    responseType: 'arraybuffer',
  });
  return topGameFromCounts(parseGameCounts(res.data as ArrayBuffer));
}

// 주간지표용: 여러 OEM 합산 후 인기 콘텐츠
export async function fetchCombinedTopContent(
  api: AxiosInstance,
  range: DateRange,
  oemParamsList: PickjoyOEMParams[]
): Promise<string> {
  const combined = new Map<string, number>();

  for (const oemParams of oemParamsList) {
    const res = await api.get('/api/admin/v1/statistics/export', {
      params: { statisticsSearchType: 'DAILY', ...range, ...oemParams },
      responseType: 'arraybuffer',
    });
    const counts = parseGameCounts(res.data as ArrayBuffer);
    counts.forEach((count, name) => {
      combined.set(name, (combined.get(name) ?? 0) + count);
    });
  }

  return topGameFromCounts(combined);
}

function topGameFromCounts(counts: Map<string, number>): string {
  let topGame = '';
  let topCount = -1;
  counts.forEach((count, name) => {
    if (count > topCount) {
      topCount = count;
      topGame = name;
    }
  });
  return topGame;
}

function parseGameCounts(buffer: ArrayBuffer): Map<string, number> {
  const workbook = XLSX.read(buffer, { type: 'array' });
  console.log('[parseGameCounts] 시트 목록:', Object.keys(workbook.Sheets));

  const sheet = workbook.Sheets['게임별 실행 수'];
  if (!sheet) {
    console.warn('[parseGameCounts] "게임별 실행 수" 시트를 찾을 수 없습니다.');
    return new Map();
  }

  const aoa = XLSX.utils.sheet_to_json<(string | number | undefined)[]>(sheet, { header: 1 });

  // ' - 실행 수' 접미사 컬럼이 있는 행을 동적으로 탐색
  let headerRowIndex = -1;
  for (let i = 0; i < Math.min(aoa.length, 20); i++) {
    const row = aoa[i] ?? [];
    if (row.some((cell) => String(cell ?? '').trim().endsWith(' - 실행 수'))) {
      headerRowIndex = i;
      break;
    }
  }

  if (headerRowIndex === -1) {
    console.warn('[parseGameCounts] "- 실행 수" 헤더 행을 찾을 수 없습니다. 첫 10행:', aoa.slice(0, 10));
    return new Map();
  }

  const headerRow = aoa[headerRowIndex] ?? [];
  const dataRows = aoa.slice(headerRowIndex + 1);
  console.log('[parseGameCounts] 헤더 행 index:', headerRowIndex, '내용:', headerRow);

  const counts = new Map<string, number>();
  for (let i = 0; i < headerRow.length; i++) {
    const header = String(headerRow[i] ?? '').trim();
    if (!header.endsWith(' - 실행 수')) continue;
    const gameName = header.replace(/ - 실행 수$/, '').trim();
    const total = dataRows.reduce((sum, row) => {
      const val = row[i];
      return sum + (typeof val === 'number' ? val : 0);
    }, 0);
    counts.set(gameName, total);
  }

  if (counts.size === 0) {
    console.warn('[parseGameCounts] "- 실행 수" 컬럼 없음. 헤더 행:', headerRow);
  }

  return counts;
}
