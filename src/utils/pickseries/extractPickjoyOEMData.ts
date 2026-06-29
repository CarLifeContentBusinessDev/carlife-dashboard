import axios from 'axios';
import type { OEMGroup } from '@/utils/googleSheets/fetchPickSeriesOEMSheet';
import { PICKJOY_OEM_PARAMS } from './pickjoyOEMConfig';
import {
  fetchRegisteredVinCount,
  fetchServiceStats,
  fetchContentsStats,
  fetchTopContent,
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

  const allSelectedItems = new Set<string>();
  oems.forEach((oem) => {
    selectedItemsByOEM[oem.name]?.forEach((item) => allSelectedItems.add(item));
  });

  const needsUserStatus = allSelectedItems.has('누적 사용자 수');
  const needsServiceStatus = allSelectedItems.has('WAU') || allSelectedItems.has('총 클릭 수');
  const needsContentsStatus =
    allSelectedItems.has('총 콘텐츠 클릭수') || allSelectedItems.has('총 콘텐츠 사용시간');
  const exportOEMs = allSelectedItems.has('주간 인기 콘텐츠')
    ? oems.filter((oem) => selectedItemsByOEM[oem.name]?.has('주간 인기 콘텐츠'))
    : [];

  const callsPerDate =
    (needsUserStatus ? 1 : 0) +
    (needsServiceStatus ? 1 : 0) +
    (needsContentsStatus ? 1 : 0) +
    exportOEMs.length;

  const total = dates.length * callsPerDate;
  let completed = 0;

  const results: OEMExtractionResult = {};

  for (const sheetDate of dates) {
    results[sheetDate] = {};
    oems.forEach((oem) => {
      results[sheetDate][oem.name] = {};
    });

    const { startDate, endDate } = sheetDateToApiDates(sheetDate);

    if (needsUserStatus) {
      onProgress({ completed, total, currentLabel: `${sheetDate} — 누적 사용자 수` });
      const value = await fetchRegisteredVinCount(apiInstance, { startDate, endDate });
      oems.forEach((oem) => {
        if (selectedItemsByOEM[oem.name]?.has('누적 사용자 수')) {
          results[sheetDate][oem.name]['누적 사용자 수'] = value;
        }
      });
      completed++;
    }

    if (needsServiceStatus) {
      onProgress({ completed, total, currentLabel: `${sheetDate} — WAU / 총 클릭 수` });
      const { wau, totalClicks } = await fetchServiceStats(apiInstance, { startDate, endDate });
      oems.forEach((oem) => {
        if (selectedItemsByOEM[oem.name]?.has('WAU')) {
          results[sheetDate][oem.name]['WAU'] = wau;
        }
        if (selectedItemsByOEM[oem.name]?.has('총 클릭 수')) {
          results[sheetDate][oem.name]['총 클릭 수'] = totalClicks;
        }
      });
      completed++;
    }

    if (needsContentsStatus) {
      onProgress({ completed, total, currentLabel: `${sheetDate} — 콘텐츠 통계` });
      const { contentClicks, contentPlayTime } = await fetchContentsStats(apiInstance, {
        startDate,
        endDate,
      });
      oems.forEach((oem) => {
        if (selectedItemsByOEM[oem.name]?.has('총 콘텐츠 클릭수')) {
          results[sheetDate][oem.name]['총 콘텐츠 클릭수'] = contentClicks;
        }
        if (selectedItemsByOEM[oem.name]?.has('총 콘텐츠 사용시간')) {
          results[sheetDate][oem.name]['총 콘텐츠 사용시간'] = contentPlayTime;
        }
      });
      completed++;
    }

    for (const oem of exportOEMs) {
      onProgress({
        completed,
        total,
        currentLabel: `${sheetDate} — 주간 인기 콘텐츠 (${oem.name})`,
      });
      const oemParams = PICKJOY_OEM_PARAMS[oem.name];
      if (oemParams) {
        const topContent = await fetchTopContent(apiInstance, { startDate, endDate }, oemParams);
        results[sheetDate][oem.name]['주간 인기 콘텐츠'] = topContent;
      }
      completed++;
    }
  }

  return results;
}
