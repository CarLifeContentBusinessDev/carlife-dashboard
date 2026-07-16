import type { ExtractionProgress } from './extractPickjoyOEMData';
import {
  createPickjoyApi,
  fetchServiceStats,
  fetchContentsStats,
  fetchCombinedTopContent,
  fetchCombinedRegisteredVinCount,
  fetchCombinedActiveUsers,
  type PickjoyOEMParams,
} from './pickjoyItemApis';
import {
  PICKJOY_WEEKLY_ITEM_KEYS,
  PICKJOY_WEEKLY_TOP_CONTENT,
  PICKJOY_WEEKLY_OEMS,
  getActiveWeeklyOEMs,
} from './pickjoyWeeklyConfig';
import { buildOEMParamsMap, type OEMApiParams } from './resolveOEMParams';

export type WeeklyExtractionResult = Record<
  string,
  Record<string, string | number>
>;

function sheetDateToApiDates(sheetDate: string): {
  startDate: string;
  endDate: string;
} {
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

function toMonthStart(apiDate: string): string {
  return `${apiDate.slice(0, 7)}-01`;
}

function addDays(apiDate: string, days: number): string {
  const d = new Date(apiDate);
  d.setUTCDate(d.getUTCDate() + days);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function buildOemParamsList(
  oemNames: string[],
  oemParamsMap: Record<string, OEMApiParams>
): PickjoyOEMParams[] {
  return oemNames.flatMap((name) => {
    const resolved = oemParamsMap[name];
    if (!resolved) return [];
    return resolved.companySeqs.map((companySeq) => ({
      manufacturerSeq: resolved.manufacturerSeq,
      deviceSeq: resolved.deviceSeq,
      companySeq,
    }));
  });
}

export async function extractPickjoyWeeklyData(params: {
  token: string;
  selectedItems: Set<string>;
  dates: string[];
  onProgress: (progress: ExtractionProgress) => void;
}): Promise<WeeklyExtractionResult> {
  const { token, selectedItems, dates, onProgress } = params;

  const api = createPickjoyApi(token);

  const keys = PICKJOY_WEEKLY_ITEM_KEYS;

  const needsUserStatus = selectedItems.has(keys.registeredVinCount);
  const needsWAU = selectedItems.has(keys.wau);
  const needsTotalClicks = selectedItems.has(keys.totalClicks);
  const needsContentsStatus =
    selectedItems.has(keys.contentClicks) ||
    selectedItems.has(keys.contentPlayTime);
  const topContentItems = PICKJOY_WEEKLY_TOP_CONTENT.filter(({ itemName }) =>
    selectedItems.has(itemName)
  );
  const needsOEMParams =
    needsUserStatus || needsWAU || topContentItems.length > 0;

  const oemParamsMap = needsOEMParams
    ? await buildOEMParamsMap(
        api,
        PICKJOY_WEEKLY_OEMS.map((oem) => oem.name)
      )
    : {};

  if (needsOEMParams) {
    PICKJOY_WEEKLY_OEMS.forEach((oem) => {
      if (!oemParamsMap[oem.name]) {
        console.warn(
          `[extractPickjoyWeeklyData] "${oem.name}" OEM의 manufacturer/device seq를 API에서 찾지 못했습니다. 이름 불일치 가능성 — 값이 0으로 나옵니다.`
        );
      }
    });
  }

  function oemParamsListForDate(sheetDate: string): PickjoyOEMParams[] {
    const activeNames = getActiveWeeklyOEMs(sheetDate).map((oem) => oem.name);
    return buildOemParamsList(activeNames, oemParamsMap);
  }

  // 해당 주차만의 신규 가입 VIN (7일치 DAILY 합산)
  async function fetchWeeklyNewVin(sheetDate: string): Promise<number> {
    const oemParamsList = oemParamsListForDate(sheetDate);
    if (oemParamsList.length === 0) return 0;
    const { startDate, endDate } = sheetDateToApiDates(sheetDate);
    return fetchCombinedRegisteredVinCount(
      api,
      { startDate, endDate },
      oemParamsList,
      'DAILY'
    );
  }

  // 누적 사용자 수 : 해당 주차가 속한 달 이전은 MONTHLY로 한 번에 합산하고, 해당 달(주차 포함)은 DAILY로 합산
  async function computeAbsoluteRegisteredVin(
    sheetDate: string
  ): Promise<number> {
    const { endDate: weekEnd } = sheetDateToApiDates(sheetDate);
    const monthStart = toMonthStart(weekEnd);
    const activeOEMs = getActiveWeeklyOEMs(sheetDate);

    const promises = activeOEMs.map(async (oem) => {
      const resolved = oemParamsMap[oem.name];
      if (!resolved) return 0;
      const oemParamsList = resolved.companySeqs.map((companySeq) => ({
        manufacturerSeq: resolved.manufacturerSeq,
        deviceSeq: resolved.deviceSeq,
        companySeq,
      }));

      const historyStart = `${oem.availableFrom.replace('.', '-')}-01`;
      const historyEnd = addDays(monthStart, -1);

      const tasks: Promise<number>[] = [];
      if (historyStart <= historyEnd) {
        tasks.push(
          fetchCombinedRegisteredVinCount(
            api,
            { startDate: historyStart, endDate: historyEnd },
            oemParamsList,
            'MONTHLY'
          )
        );
      }
      tasks.push(
        fetchCombinedRegisteredVinCount(
          api,
          { startDate: monthStart, endDate: weekEnd },
          oemParamsList,
          'DAILY'
        )
      );

      const results = await Promise.all(tasks);
      return results.reduce((sum, val) => sum + val, 0);
    });

    const oemTotals = await Promise.all(promises);
    return oemTotals.reduce((sum, val) => sum + val, 0);
  }

  const results: WeeklyExtractionResult = {};
  dates.forEach((d) => {
    results[d] = {};
  });

  const callsPerDate =
    (needsUserStatus ? 1 : 0) +
    (needsWAU ? 1 : 0) +
    (needsTotalClicks ? 1 : 0) +
    (needsContentsStatus ? 1 : 0) +
    topContentItems.length;

  const total = dates.length * callsPerDate;
  let completed = 0;

  // 배치의 첫 주차만 절대값(월간 이력 + 이번 달 일간)을 계산하고
  // 이후 주차는 '직전 계산값 + 그 주차만의 신규 가입 VIN'으로 누적
  if (needsUserStatus) {
    const sortedDates = [...dates].sort();
    let runningTotal = 0;

    for (let i = 0; i < sortedDates.length; i++) {
      const date = sortedDates[i];
      onProgress({
        completed,
        total,
        currentLabel: `${date} — ${keys.registeredVinCount}`,
      });

      runningTotal =
        i === 0
          ? await computeAbsoluteRegisteredVin(date)
          : runningTotal + (await fetchWeeklyNewVin(date));

      results[date][keys.registeredVinCount] = runningTotal;
      completed++;
    }
  }

  for (const sheetDate of dates) {
    const { startDate, endDate } = sheetDateToApiDates(sheetDate);

    if (needsWAU) {
      onProgress({
        completed,
        total,
        currentLabel: `${sheetDate} — WAU`,
      });
      const oemParamsList = oemParamsListForDate(sheetDate);
      results[sheetDate][keys.wau] =
        oemParamsList.length > 0
          ? await fetchCombinedActiveUsers(
              api,
              { startDate, endDate },
              oemParamsList
            )
          : 0;
      completed++;
    }

    if (needsTotalClicks) {
      onProgress({
        completed,
        total,
        currentLabel: `${sheetDate} — 총 클릭 수`,
      });
      const { totalClicks } = await fetchServiceStats(api, {
        startDate,
        endDate,
      });
      results[sheetDate][keys.totalClicks] = totalClicks;
      completed++;
    }

    if (needsContentsStatus) {
      onProgress({
        completed,
        total,
        currentLabel: `${sheetDate} — 콘텐츠 통계`,
      });
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

    for (const { itemName } of topContentItems) {
      onProgress({
        completed,
        total,
        currentLabel: `${sheetDate} — ${itemName}`,
      });
      const oemParamsList = oemParamsListForDate(sheetDate);
      results[sheetDate][itemName] =
        oemParamsList.length > 0
          ? await fetchCombinedTopContent(
              api,
              { startDate, endDate },
              oemParamsList
            )
          : '';
      completed++;
    }
  }

  return results;
}
