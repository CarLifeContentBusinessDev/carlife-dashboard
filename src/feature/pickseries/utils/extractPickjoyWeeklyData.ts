import axios from 'axios';
import type { ExtractionProgress } from './extractPickjoyOEMData';
import {
  fetchRegisteredVinCount,
  fetchServiceStats,
  fetchContentsStats,
  fetchCombinedTopContent,
} from './pickjoyItemApis';
import {
  PICKJOY_WEEKLY_ITEM_KEYS,
  PICKJOY_WEEKLY_TOP_CONTENT,
} from './pickjoyWeeklyConfig';

// date → itemName → value
export type WeeklyExtractionResult = Record<string, Record<string, string | number>>;

function sheetDateToApiDates(sheetDate: string): { startDate: string; endDate: string } {
  const parts = sheetDate.split('.');
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);

  const fmt = (d: Date): string =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  return {
    startDate: fmt(new Date(year, month - 1, day)),
    endDate: fmt(new Date(year, month - 1, day + 6)),
  };
}

export async function extractPickjoyWeeklyData(params: {
  token: string;
  selectedItems: Set<string>;
  dates: string[];
  onProgress: (progress: ExtractionProgress) => void;
}): Promise<WeeklyExtractionResult> {
  const { token, selectedItems, dates, onProgress } = params;

  const api = axios.create({
    baseURL: import.meta.env.VITE_PICKJOY_API_URL as string,
    headers: { Authorization: `Bearer ${token}` },
  });

  const keys = PICKJOY_WEEKLY_ITEM_KEYS;

  const needsUserStatus = selectedItems.has(keys.registeredVinCount);
  const needsServiceStatus = selectedItems.has(keys.wau) || selectedItems.has(keys.totalClicks);
  const needsContentsStatus =
    selectedItems.has(keys.contentClicks) || selectedItems.has(keys.contentPlayTime);
  const topContentItems = PICKJOY_WEEKLY_TOP_CONTENT.filter(({ itemName }) =>
    selectedItems.has(itemName)
  );

  const callsPerDate =
    (needsUserStatus ? 1 : 0) +
    (needsServiceStatus ? 1 : 0) +
    (needsContentsStatus ? 1 : 0) +
    topContentItems.length;

  const total = dates.length * callsPerDate;
  let completed = 0;
  const results: WeeklyExtractionResult = {};

  for (const sheetDate of dates) {
    results[sheetDate] = {};
    const { startDate, endDate } = sheetDateToApiDates(sheetDate);

    if (needsUserStatus) {
      onProgress({ completed, total, currentLabel: `${sheetDate} — ${keys.registeredVinCount}` });
      results[sheetDate][keys.registeredVinCount] = await fetchRegisteredVinCount(api, {
        startDate,
        endDate,
      });
      completed++;
    }

    if (needsServiceStatus) {
      onProgress({ completed, total, currentLabel: `${sheetDate} — WAU / 총 클릭 수` });
      const { wau, totalClicks } = await fetchServiceStats(api, { startDate, endDate });
      if (selectedItems.has(keys.wau)) results[sheetDate][keys.wau] = wau;
      if (selectedItems.has(keys.totalClicks)) results[sheetDate][keys.totalClicks] = totalClicks;
      completed++;
    }

    if (needsContentsStatus) {
      onProgress({ completed, total, currentLabel: `${sheetDate} — 콘텐츠 통계` });
      const { contentClicks, contentPlayTime } = await fetchContentsStats(api, {
        startDate,
        endDate,
      });
      if (selectedItems.has(keys.contentClicks))
        results[sheetDate][keys.contentClicks] = contentClicks;
      if (selectedItems.has(keys.contentPlayTime))
        results[sheetDate][keys.contentPlayTime] = contentPlayTime;
      completed++;
    }

    for (const { itemName, oemParamsList } of topContentItems) {
      onProgress({ completed, total, currentLabel: `${sheetDate} — ${itemName}` });
      results[sheetDate][itemName] = await fetchCombinedTopContent(
        api,
        { startDate, endDate },
        oemParamsList
      );
      completed++;
    }
  }

  return results;
}
