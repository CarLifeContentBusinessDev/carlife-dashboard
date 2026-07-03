import axios, { type AxiosInstance } from 'axios';
import * as XLSX from 'xlsx';

const PICKJOY_TOKEN_EXPIRED_MESSAGE =
  '픽조이 로그인이 만료되었습니다. 다시 로그인해주세요.';

function logoutPickjoy(): void {
  import('@/feature/pickseries/store/usePickSeriesServerStore').then(
    ({ usePickSeriesServerStore }) => {
      usePickSeriesServerStore.getState().clearServerToken('pickjoy');
    }
  );
}

export function createPickjoyApi(token: string): AxiosInstance {
  const instance = axios.create({
    baseURL: import.meta.env.VITE_PICKJOY_API_URL as string,
    headers: { Authorization: `Bearer ${token}` },
  });

  instance.interceptors.response.use((response) => {
    if (response.config.responseType === 'arraybuffer') {
      const buffer = response.data as ArrayBuffer;
      const bytes = new Uint8Array(buffer.slice(0, 2));
      const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b; // 'PK'
      if (!isZip) {
        try {
          const text = new TextDecoder('utf-8').decode(buffer);
          const json = JSON.parse(text) as { resultCode?: string };
          if (json.resultCode === 'E0123') {
            logoutPickjoy();
            return Promise.reject(new Error(PICKJOY_TOKEN_EXPIRED_MESSAGE));
          }
        } catch {
          // JSON 파싱 실패 시 아래에서 엑셀 파일 오류로 처리
        }
        return Promise.reject(
          new Error('통계 export 응답이 올바른 엑셀 파일이 아닙니다.')
        );
      }
      return response;
    }

    const resultCode = (response.data as { resultCode?: string })?.resultCode;
    if (resultCode === 'E0123') {
      logoutPickjoy();
      return Promise.reject(new Error(PICKJOY_TOKEN_EXPIRED_MESSAGE));
    }

    return response;
  });

  return instance;
}

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
export type StatisticsSearchType = 'DAILY' | 'MONTHLY';

function sumDaily(stats: DailyStat[], key: string): number {
  return stats.reduce((sum, day) => sum + (Number(day[key]) || 0), 0);
}

// searchType에 따라 export 응답에 실제로 담길 데이터 행 수를 계산 (DAILY || MONTHLY)
function countExpectedRows(
  range: DateRange,
  searchType: StatisticsSearchType
): number {
  const start = new Date(range.startDate);
  const end = new Date(range.endDate);

  if (searchType === 'MONTHLY') {
    return (
      (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
      (end.getUTCMonth() - start.getUTCMonth()) +
      1
    );
  }

  return Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
}

// 주간지표 - 누적 사용자 수 ('서비스 통계' 탭의 '가입 VIN' 단일 컬럼 사용)
export async function fetchCombinedRegisteredVinCount(
  api: AxiosInstance,
  range: DateRange,
  oemParamsList: PickjoyOEMParams[],
  searchType: StatisticsSearchType = 'DAILY'
): Promise<number> {
  const expectedRows = countExpectedRows(range, searchType);
  const promises = oemParamsList.map(async (oemParams) => {
    const res = await api.get('/api/admin/v1/statistics/export', {
      params: { statisticsSearchType: searchType, ...range, ...oemParams },
      responseType: 'arraybuffer',
    });
    const { registeredVin } = parseServiceStats(
      res.data as ArrayBuffer,
      expectedRows
    );
    return registeredVin;
  });

  const results = await Promise.all(promises);
  return results.reduce((sum, val) => sum + val, 0);
}

// 주간지표 - WAU, 총 클릭 수
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

// 주간지표 - 총 콘텐츠 클릭 수, 사용시간
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

// OEM 지표 - 단일 OEM '서비스 통계' 탭 → 누적 사용자 수 + 활성 사용자 수
function parseServiceStats(
  buffer: ArrayBuffer,
  expectedRows: number
): {
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

  for (
    let r = DATA_START_ROW;
    r < DATA_START_ROW + expectedRows && r < aoa.length;
    r++
  ) {
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
  return parseServiceStats(
    res.data as ArrayBuffer,
    countExpectedRows(range, 'DAILY')
  );
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
