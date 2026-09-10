import type {
  ExtractionProgress,
  OEMExtractionResult,
} from '@/feature/pickseries/utils/extractionTypes';
import type { OEMGroup } from '@/feature/pickseries/utils/fetchPickSeriesOEMSheet';
import { weekKeyOf } from '@/feature/pickseries/utils/weekKey';
import { createPickleApi, fetchUserDaily, weekRange } from './pickleItemApis';

const OEM_ITEMS = {
  cumUser: '누적 사용자 수',
} as const;

// 활성/신규/재방문 사용자 수는 데이터 확인 중이라 보류. 지금은 누적 사용자 수만.
export const PICKLE_OEM_ITEMS: readonly string[] = Object.values(OEM_ITEMS);

// 시트 4행 OEM 헤더 → user-daily/search 응답의 oem 필드 값
const OEM_API_KEY: Record<string, string> = {
  '기아 (PV5)': 'kia',
  '현대 (Connect OS)': '42dot',
  '르노 (AR1, AR2)': 'renault',
  볼보: 'VolvoCars',
  폴스타: 'Polestar',
};

const TOTAL_OEM = '전체';

export async function extractPickleOEMData(params: {
  token: string;
  oems: OEMGroup[];
  selectedItemsByOEM: Record<string, Set<string>>;
  dates: string[];
  onProgress: (p: ExtractionProgress) => void;
}): Promise<OEMExtractionResult> {
  const { token, oems, selectedItemsByOEM, dates, onProgress } = params;
  const api = createPickleApi(token);

  // 누적 사용자 수가 선택된 OEM만 대상
  const targetOEMs = oems.filter((oem) =>
    selectedItemsByOEM[oem.name]?.has(OEM_ITEMS.cumUser)
  );

  const total = dates.length;
  let completed = 0;

  const results: OEMExtractionResult = {};

  for (const sheetDate of dates) {
    results[sheetDate] = {};
    if (targetOEMs.length === 0) {
      completed++;
      continue;
    }

    onProgress({
      completed,
      total,
      currentLabel: `${sheetDate} — 누적 사용자 수`,
    });

    // 시트별 주차 시작일 표기가 달라도(월/일) API 조회 창은 정규 주차(월~일)로 고정
    const range = weekRange(weekKeyOf(sheetDate));
    // oem 파라미터 없이 한 번 호출 → 응답에 oem 필드별 행이 담겨온다.
    const rows = await fetchUserDaily(api, range);
    // 주차 마지막날(일요일 = toDate) 행만 사용 (누적값)
    const lastRows = rows.filter((r) => r.date === range.toDate);
    if (lastRows.length === 0) {
      console.warn(
        `[extractPickleOEMData] ${sheetDate}: 마지막날(${range.toDate}) 행 없음. 응답 날짜:`,
        [...new Set(rows.map((r) => r.date))]
      );
    }

    for (const oem of targetOEMs) {
      results[sheetDate][oem.name] = {};
      if (oem.name === TOTAL_OEM) {
        results[sheetDate][oem.name][OEM_ITEMS.cumUser] = lastRows.reduce(
          (s, r) => s + (r.memberCnt || 0) + (r.guestCnt || 0),
          0
        );
        continue;
      }
      const key = OEM_API_KEY[oem.name];
      if (!key) {
        console.warn(
          `[extractPickleOEMData] OEM "${oem.name}" 에 대응하는 oem 값 없음. OEM_API_KEY 확인 필요.`
        );
        continue;
      }
      results[sheetDate][oem.name][OEM_ITEMS.cumUser] = lastRows
        .filter((r) => r.oem === key)
        .reduce((s, r) => s + (r.memberCnt || 0) + (r.guestCnt || 0), 0);
    }

    completed++;
  }

  onProgress({ completed, total, currentLabel: '완료' });
  return results;
}
