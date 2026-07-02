import type { OEMGroup } from '@/feature/pickseries/utils/fetchPickSeriesOEMSheet';
import { executeWithConcurrencyLimit } from '@/shared/utils/api/requestPool';
import {
  createPickjoyApi,
  fetchServiceStatsFromExport,
  fetchCombinedRegisteredVinCount,
  type PickjoyOEMParams,
} from './pickjoyItemApis';
import { buildOEMParamsMap } from './resolveOEMParams';
import { PICKJOY_WEEKLY_OEMS } from './pickjoyWeeklyConfig';

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

const REGISTERED_VIN_KEY = '누적 사용자 수';
const ACTIVE_USERS_KEY = '활성 사용자 수';

function sheetDateToApiDates(sheetDate: string): {
  startDate: string;
  endDate: string;
} {
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

function toMonthStart(apiDate: string): string {
  return `${apiDate.slice(0, 7)}-01`;
}

function addDays(apiDate: string, days: number): string {
  const d = new Date(apiDate);
  d.setUTCDate(d.getUTCDate() + days);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

export async function extractPickjoyOEMData(params: {
  token: string;
  oems: OEMGroup[];
  selectedItemsByOEM: Record<string, Set<string>>;
  dates: string[];
  onProgress: (progress: ExtractionProgress) => void;
}): Promise<OEMExtractionResult> {
  const { token, oems, selectedItemsByOEM, dates, onProgress } = params;

  const apiInstance = createPickjoyApi(token);

  const allSelectedItems = new Set<string>();
  oems.forEach((oem) => {
    selectedItemsByOEM[oem.name]?.forEach((item) => allSelectedItems.add(item));
  });

  const needsRegisteredVin = allSelectedItems.has(REGISTERED_VIN_KEY);
  const needsActiveUsers = allSelectedItems.has(ACTIVE_USERS_KEY);
  const needsStats = needsRegisteredVin || needsActiveUsers;

  // API에서 동적으로 OEM params 빌드 (전체 제외)
  const oemParamsMap = needsStats
    ? await buildOEMParamsMap(
        apiInstance,
        oems.map((oem) => oem.name)
      )
    : {};
  const individualOEMs = needsStats
    ? oems.filter((oem) => oem.name !== '전체' && !!oemParamsMap[oem.name])
    : [];

  const companiesCount =
    individualOEMs.length > 0
      ? (oemParamsMap[individualOEMs[0].name]?.companySeqs.length ?? 0)
      : 0;

  const activeUsersTotal = needsActiveUsers
    ? dates.length * individualOEMs.length * companiesCount
    : 0;
  // 누적 사용자 수는 주차당 1단위로 단순화해서 progress 계산 (다른 항목들과 동일한 스타일)
  const registeredVinTotal = needsRegisteredVin
    ? dates.length * individualOEMs.length
    : 0;
  const total = activeUsersTotal + registeredVinTotal;
  let completed = 0;

  const results: OEMExtractionResult = {};
  dates.forEach((sheetDate) => {
    results[sheetDate] = {};
    oems.forEach((oem) => {
      results[sheetDate][oem.name] = {};
    });
  });

  if (needsActiveUsers && individualOEMs.length > 0) {
    for (const sheetDate of dates) {
      const { startDate, endDate } = sheetDateToApiDates(sheetDate);

      type TaskResult = { oemName: string; activeUsers: number };

      const tasks = individualOEMs.flatMap((oem) => {
        const { manufacturerSeq, deviceSeq, companySeqs } =
          oemParamsMap[oem.name]!;
        return companySeqs.map(
          (companySeq) => async (): Promise<TaskResult> => {
            const stats = await fetchServiceStatsFromExport(
              apiInstance,
              { startDate, endDate },
              { manufacturerSeq, deviceSeq, companySeq }
            );
            completed++;
            onProgress({
              completed,
              total,
              currentLabel: `${sheetDate} — 활성 사용자 수 (${oem.name})`,
            });
            return { oemName: oem.name, activeUsers: stats.activeUsers };
          }
        );
      });

      const settledResults = await executeWithConcurrencyLimit(tasks, {
        concurrency: 5,
      });

      const activeByOEM: Record<string, number> = Object.fromEntries(
        individualOEMs.map((oem) => [oem.name, 0])
      );
      for (const result of settledResults) {
        if (result.status === 'fulfilled') {
          activeByOEM[result.value.oemName] += result.value.activeUsers;
        }
      }

      oems.forEach((oem) => {
        if (oem.name === '전체') {
          if (selectedItemsByOEM['전체']?.has(ACTIVE_USERS_KEY)) {
            results[sheetDate]['전체'][ACTIVE_USERS_KEY] = Object.values(
              activeByOEM
            ).reduce((s, v) => s + v, 0);
          }
        } else if (selectedItemsByOEM[oem.name]?.has(ACTIVE_USERS_KEY)) {
          results[sheetDate][oem.name][ACTIVE_USERS_KEY] =
            activeByOEM[oem.name] ?? 0;
        }
      });
    }
  }

  if (needsRegisteredVin && individualOEMs.length > 0 && dates.length > 0) {
    const sortedDates = [...dates].sort();
    const perOEMResults: Record<string, Record<string, number>> = {};

    async function fetchWeeklyNewVin(
      sheetDate: string,
      oemParamsList: PickjoyOEMParams[]
    ): Promise<number> {
      const { startDate, endDate } = sheetDateToApiDates(sheetDate);
      return fetchCombinedRegisteredVinCount(
        apiInstance,
        { startDate, endDate },
        oemParamsList,
        'DAILY'
      );
    }

    async function computeAbsoluteRegisteredVin(
      sheetDate: string,
      oemParamsList: PickjoyOEMParams[],
      availableFrom: string
    ): Promise<number> {
      const { endDate: weekEnd } = sheetDateToApiDates(sheetDate);
      const monthStart = toMonthStart(weekEnd);
      const historyStart = `${availableFrom.replace('.', '-')}-01`;
      const historyEnd = addDays(monthStart, -1);

      const tasks: Promise<number>[] = [];
      if (historyStart <= historyEnd) {
        tasks.push(
          fetchCombinedRegisteredVinCount(
            apiInstance,
            { startDate: monthStart, endDate: weekEnd },
            oemParamsList,
            'DAILY'
          )
        );
      }
      tasks.push(
        fetchCombinedRegisteredVinCount(
          apiInstance,
          { startDate: monthStart, endDate: weekEnd },
          oemParamsList,
          'DAILY'
        )
      );

      const results = await Promise.all(tasks);
      return results.reduce((sum, val) => sum + val, 0);
    }

    async function processOEM(oem: OEMGroup): Promise<void> {
      const resolved = oemParamsMap[oem.name];
      if (!resolved) return;
      const oemParamsList = resolved.companySeqs.map((companySeq) => ({
        manufacturerSeq: resolved.manufacturerSeq,
        deviceSeq: resolved.deviceSeq,
        companySeq,
      }));
      const weeklyOemInfo = PICKJOY_WEEKLY_OEMS.find(
        (w) => w.name === oem.name
      );
      if (!weeklyOemInfo) {
        console.warn(
          `[extractPickjoyOEMData] "${oem.name}"의 데이터 시작 시점(availableFrom) 정보가 없어 누적 사용자 수 계산을 건너뜁니다.`
        );
        return;
      }

      perOEMResults[oem.name] = {};
      let runningTotal = 0;

      for (let i = 0; i < sortedDates.length; i++) {
        const date = sortedDates[i];
        onProgress({
          completed,
          total,
          currentLabel: `${date} — ${REGISTERED_VIN_KEY} (${oem.name})`,
        });

        runningTotal =
          i === 0
            ? await computeAbsoluteRegisteredVin(
                date,
                oemParamsList,
                weeklyOemInfo.availableFrom
              )
            : runningTotal + (await fetchWeeklyNewVin(date, oemParamsList));

        perOEMResults[oem.name][date] = runningTotal;
        completed++;
      }
    }

    const settledOEMResults = await executeWithConcurrencyLimit(
      individualOEMs.map((oem) => () => processOEM(oem)),
      { concurrency: 5 }
    );
    settledOEMResults.forEach((result, idx) => {
      if (result.status === 'rejected') {
        console.error(
          `[extractPickjoyOEMData] "${individualOEMs[idx].name}" 누적 사용자 수 계산 실패:`,
          result.reason
        );
      }
    });
    if (settledOEMResults.every((result) => result.status === 'rejected')) {
      throw new Error(
        '누적 사용자 수 계산에 모두 실패했습니다. 콘솔 로그를 확인해주세요.'
      );
    }

    for (const sheetDate of dates) {
      const valuesForDate: Record<string, number> = {};
      individualOEMs.forEach((oem) => {
        const value = perOEMResults[oem.name]?.[sheetDate];
        if (value !== undefined) valuesForDate[oem.name] = value;
      });

      if (
        selectedItemsByOEM['전체']?.has(REGISTERED_VIN_KEY) &&
        Object.keys(valuesForDate).length > 0
      ) {
        results[sheetDate]['전체'][REGISTERED_VIN_KEY] = Object.values(
          valuesForDate
        ).reduce((s, v) => s + v, 0);
      }

      individualOEMs.forEach((oem) => {
        if (
          selectedItemsByOEM[oem.name]?.has(REGISTERED_VIN_KEY) &&
          valuesForDate[oem.name] !== undefined
        ) {
          results[sheetDate][oem.name][REGISTERED_VIN_KEY] =
            valuesForDate[oem.name];
        }
      });
    }
  }

  return results;
}
