import type { AxiosInstance } from 'axios';
import * as XLSX from 'xlsx';

export interface PickjoyOEMParams {
  manufacturerSeq: number;
  deviceSeq: number;
  companySeq: number;
}

interface ManufacturerItem {
  manufacturerSeq: number;
  manufacturerName: string;
}

interface DeviceItem {
  deviceSeq: number;
  deviceName: string;
  manufacturerSeq: number;
}

interface CompanyItem {
  companySeq: number;
  companyName: string;
}

export async function fetchManufacturers(
  api: AxiosInstance
): Promise<ManufacturerItem[]> {
  const res = await api.get<{ data: { list: ManufacturerItem[] } }>(
    '/api/admin/v1/manufacturer'
  );
  return res.data?.data?.list ?? [];
}

export async function fetchDevicesByManufacturer(
  api: AxiosInstance,
  manufacturerName: string
): Promise<DeviceItem[]> {
  const res = await api.get<{ data: { list: DeviceItem[] } }>(
    '/api/admin/v1/device',
    {
      params: { manufacturerName, isActive: true },
    }
  );
  return res.data?.data?.list ?? [];
}

export async function fetchCompanies(
  api: AxiosInstance
): Promise<CompanyItem[]> {
  const res = await api.get<{ data: { list: CompanyItem[] } }>(
    '/api/admin/v1/common/company-info'
  );
  return res.data?.data?.list ?? [];
}

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
  return sumDaily(
    res.data?.data?.dailyWeeklyMonthlyStatistics ?? [],
    'registeredVinCount'
  );
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
  const stats = res.data?.data?.dailyWeeklyMonthlyStatistics ?? [];
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
  const stats = res.data?.data?.dailyWeeklyMonthlyStatistics ?? [];
  return {
    contentClicks: sumDaily(stats, 'gameRunCount'),
    contentPlayTime: sumDaily(stats, 'totalGamePlayTime'),
  };
}

// OEM 지표용: 단일 OEM '서비스 통계' 탭 → 누적 사용자 수 + 활성 사용자 수
function parseServiceStats(buffer: ArrayBuffer): {
  registeredVin: number;
  activeUsers: number;
} {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheet = workbook.Sheets['서비스 통계'];
  if (!sheet) {
    console.warn('[parseServiceStats] "서비스 통계" 시트를 찾을 수 없습니다.');
    return { registeredVin: 0, activeUsers: 0 };
  }

  const aoa = XLSX.utils.sheet_to_json<(string | number | undefined)[]>(sheet, {
    header: 1,
  });

  const REGISTERED_VIN_HEADER = '가입 VIN';
  const ACTIVE_USERS_HEADER = '활성 사용자수(DAU/WAU/MAU)';

  let headerRowIndex = -1;
  for (let i = 0; i < Math.min(aoa.length, 20); i++) {
    const row = aoa[i] ?? [];
    const hasVin = row.some((cell) =>
      String(cell ?? '')
        .trim()
        .includes(REGISTERED_VIN_HEADER)
    );
    const hasActive = row.some((cell) =>
      String(cell ?? '')
        .trim()
        .includes(ACTIVE_USERS_HEADER)
    );
    if (hasVin && hasActive) {
      headerRowIndex = i;
      break;
    }
  }

  if (headerRowIndex === -1) {
    console.warn(
      `[parseServiceStats] "${REGISTERED_VIN_HEADER}" / "${ACTIVE_USERS_HEADER}" 헤더 행을 찾을 수 없습니다. 첫 10행:`,
      aoa.slice(0, 10)
    );
    return { registeredVin: 0, activeUsers: 0 };
  }

  const headerRow = aoa[headerRowIndex] ?? [];
  const REGISTERED_VIN_COL = headerRow.findIndex((cell) =>
    String(cell ?? '')
      .trim()
      .includes(REGISTERED_VIN_HEADER)
  );
  const ACTIVE_USERS_COL = headerRow.findIndex((cell) =>
    String(cell ?? '')
      .trim()
      .includes(ACTIVE_USERS_HEADER)
  );

  if (REGISTERED_VIN_COL === -1 || ACTIVE_USERS_COL === -1) {
    console.warn(
      '[parseServiceStats] 헤더 행에서 컬럼 인덱스를 찾지 못했습니다. 헤더 행:',
      headerRow
    );
    return { registeredVin: 0, activeUsers: 0 };
  }

  const DATA_START_ROW = headerRowIndex + 1;
  let registeredVin = 0;
  let activeUsers = 0;

  for (let r = DATA_START_ROW; r < DATA_START_ROW + 7 && r < aoa.length; r++) {
    const row = aoa[r] ?? [];
    const vin = row[REGISTERED_VIN_COL];
    const active = row[ACTIVE_USERS_COL];
    registeredVin += typeof vin === 'number' ? vin : 0;
    activeUsers += typeof active === 'number' ? active : 0;
  }

  return { registeredVin, activeUsers };
}

export async function fetchServiceStatsFromExport(
  api: AxiosInstance,
  range: DateRange,
  oemParams: PickjoyOEMParams
): Promise<{ registeredVin: number; activeUsers: number }> {
  const res = await api.get('/api/admin/v1/statistics/export', {
    params: { statisticsSearchType: 'DAILY', ...range, ...oemParams },
    responseType: 'arraybuffer',
  });
  return parseServiceStats(res.data as ArrayBuffer);
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

  const aoa = XLSX.utils.sheet_to_json<(string | number | undefined)[]>(sheet, {
    header: 1,
  });

  // ' - 실행 수' 접미사 컬럼이 있는 행을 동적으로 탐색
  let headerRowIndex = -1;
  for (let i = 0; i < Math.min(aoa.length, 20); i++) {
    const row = aoa[i] ?? [];
    if (
      row.some((cell) =>
        String(cell ?? '')
          .trim()
          .endsWith(' - 실행 수')
      )
    ) {
      headerRowIndex = i;
      break;
    }
  }

  if (headerRowIndex === -1) {
    console.warn(
      '[parseGameCounts] "- 실행 수" 헤더 행을 찾을 수 없습니다. 첫 10행:',
      aoa.slice(0, 10)
    );
    return new Map();
  }

  const headerRow = aoa[headerRowIndex] ?? [];
  const dataRows = aoa.slice(headerRowIndex + 1);
  console.log(
    '[parseGameCounts] 헤더 행 index:',
    headerRowIndex,
    '내용:',
    headerRow
  );

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
    console.warn(
      '[parseGameCounts] "- 실행 수" 컬럼 없음. 헤더 행:',
      headerRow
    );
  }

  return counts;
}
