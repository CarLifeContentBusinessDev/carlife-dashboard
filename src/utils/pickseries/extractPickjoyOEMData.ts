import axios from 'axios';
import type { OEMGroup } from '@/utils/googleSheets/fetchPickSeriesOEMSheet';
import {
  fetchManufacturers,
  fetchDevicesByManufacturer,
  fetchCompanies,
  fetchServiceStatsFromExport,
} from './pickjoyItemApis';

export type ExtractionProgress = {
  completed: number;
  total: number;
  currentLabel: string;
};

// date → oemName → itemName → value
export type OEMExtractionResult = Record<
  string,
  Record<string, Record<string, string | number>>
>;

interface OEMApiParams {
  manufacturerSeq: number;
  deviceSeq: number;
  companySeqs: number[];
}

function sheetDateToApiDates(sheetDate: string): { startDate: string; endDate: string } {
  const parts = sheetDate.split('.');
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);

  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  return {
    startDate: fmt(new Date(year, month - 1, day)),
    endDate: fmt(new Date(year, month - 1, day + 6)),
  };
}

// 시트 OEM명 파싱: "AR1(Renault)" → { deviceName: "AR1", manufacturerName: "Renault" }
function parseOEMName(name: string): { deviceName: string; manufacturerName: string } | null {
  const match = name.match(/^(.+)\((.+)\)$/);
  if (!match) return null;
  return { deviceName: match[1].trim(), manufacturerName: match[2].trim() };
}

// API에서 manufacturer/device/company를 조회해 OEM별 params 빌드
async function buildOEMParamsMap(
  api: ReturnType<typeof axios.create>,
  oems: OEMGroup[]
): Promise<Record<string, OEMApiParams>> {
  const [manufacturers, companies] = await Promise.all([
    fetchManufacturers(api),
    fetchCompanies(api),
  ]);

  const deviceLists = await Promise.all(
    manufacturers.map((m) => fetchDevicesByManufacturer(api, m.manufacturerName))
  );
  const allDevices = deviceLists.flat();

  const companySeqs = companies.map((c) => c.companySeq);
  const paramsMap: Record<string, OEMApiParams> = {};

  for (const oem of oems) {
    const parsed = parseOEMName(oem.name);
    if (!parsed) continue;

    const manufacturer = manufacturers.find(
      (m) => m.manufacturerName === parsed.manufacturerName
    );
    if (!manufacturer) continue;

    const device = allDevices.find(
      (d) => d.deviceName === parsed.deviceName && d.manufacturerSeq === manufacturer.manufacturerSeq
    );
    if (!device) continue;

    paramsMap[oem.name] = {
      manufacturerSeq: manufacturer.manufacturerSeq,
      deviceSeq: device.deviceSeq,
      companySeqs,
    };
  }

  return paramsMap;
}

export async function extractPickjoyOEMData(params: {
  token: string;
  oems: OEMGroup[];
  selectedItemsByOEM: Record<string, Set<string>>;
  dates: string[];
  onProgress: (progress: ExtractionProgress) => void;
}): Promise<OEMExtractionResult> {
  const { token, oems, selectedItemsByOEM, dates, onProgress } = params;

  const apiInstance = axios.create({
    baseURL: import.meta.env.VITE_PICKJOY_API_URL as string,
    headers: { Authorization: `Bearer ${token}` },
  });

  const REGISTERED_VIN_KEY = '누적 사용자 수';
  const ACTIVE_USERS_KEY = '활성 사용자 수';

  const allSelectedItems = new Set<string>();
  oems.forEach((oem) => {
    selectedItemsByOEM[oem.name]?.forEach((item) => allSelectedItems.add(item));
  });

  const needsStats =
    allSelectedItems.has(REGISTERED_VIN_KEY) || allSelectedItems.has(ACTIVE_USERS_KEY);

  // API에서 동적으로 OEM params 빌드 (전체 제외)
  const oemParamsMap = needsStats ? await buildOEMParamsMap(apiInstance, oems) : {};
  const individualOEMs = needsStats
    ? oems.filter((oem) => oem.name !== '전체' && !!oemParamsMap[oem.name])
    : [];

  const companiesCount =
    individualOEMs.length > 0
      ? (oemParamsMap[individualOEMs[0].name]?.companySeqs.length ?? 0)
      : 0;
  const total = dates.length * individualOEMs.length * companiesCount;
  let completed = 0;

  const results: OEMExtractionResult = {};

  for (const sheetDate of dates) {
    results[sheetDate] = {};
    oems.forEach((oem) => {
      results[sheetDate][oem.name] = {};
    });

    const { startDate, endDate } = sheetDateToApiDates(sheetDate);

    if (individualOEMs.length > 0) {
      const oemStats: Record<string, { registeredVin: number; activeUsers: number }> = {};

      for (const oem of individualOEMs) {
        const { manufacturerSeq, deviceSeq, companySeqs } = oemParamsMap[oem.name]!;
        let totalRegisteredVin = 0;
        let totalActiveUsers = 0;

        for (const companySeq of companySeqs) {
          onProgress({
            completed,
            total,
            currentLabel: `${sheetDate} — 서비스 통계 (${oem.name})`,
          });
          const stats = await fetchServiceStatsFromExport(
            apiInstance,
            { startDate, endDate },
            { manufacturerSeq, deviceSeq, companySeq }
          );
          totalRegisteredVin += stats.registeredVin;
          totalActiveUsers += stats.activeUsers;
          completed++;
        }

        oemStats[oem.name] = {
          registeredVin: totalRegisteredVin,
          activeUsers: totalActiveUsers,
        };
      }

      oems.forEach((oem) => {
        if (oem.name === '전체') {
          const totalRegistered = Object.values(oemStats).reduce(
            (s, v) => s + v.registeredVin,
            0
          );
          const totalActive = Object.values(oemStats).reduce(
            (s, v) => s + v.activeUsers,
            0
          );
          if (selectedItemsByOEM['전체']?.has(REGISTERED_VIN_KEY)) {
            results[sheetDate]['전체'][REGISTERED_VIN_KEY] = totalRegistered;
          }
          if (selectedItemsByOEM['전체']?.has(ACTIVE_USERS_KEY)) {
            results[sheetDate]['전체'][ACTIVE_USERS_KEY] = totalActive;
          }
        } else {
          const stats = oemStats[oem.name];
          if (stats) {
            if (selectedItemsByOEM[oem.name]?.has(REGISTERED_VIN_KEY)) {
              results[sheetDate][oem.name][REGISTERED_VIN_KEY] = stats.registeredVin;
            }
            if (selectedItemsByOEM[oem.name]?.has(ACTIVE_USERS_KEY)) {
              results[sheetDate][oem.name][ACTIVE_USERS_KEY] = stats.activeUsers;
            }
          }
        }
      });
    }
  }

  return results;
}
