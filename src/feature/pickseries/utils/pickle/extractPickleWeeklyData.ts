import type {
  ExtractionProgress,
  WeeklyExtractionResult,
} from '@/feature/pickseries/utils/extractionTypes';
import {
  createPickleApi,
  fetchHitHomeTab,
  fetchUserDaily,
  weekRange,
} from './pickleItemApis';

const ITEMS = {
  cumUser: '누적 사용자 수',
  cumGuest: '누적 비회원 수',
  cumMember: '누적 회원 수',
  newUser: '신규 사용자 수',
  home: '홈 - 메뉴 터치 수',
  radio: '라디오 - 메뉴 터치 수',
  category: '카테고리 - 메뉴 터치 수',
  recent: '최근청취 - 메뉴 터치 수',
} as const;

// WAU: user-weekly/search 응답이 API 자체 주 그리드(일~토)라 픽클 운영 주(월~일)와
// 어긋난다. 값 왜곡 방지 위해 연동 보류.
export const PICKLE_WEEKLY_ITEMS: readonly string[] = Object.values(ITEMS);

const MENU_TAB: Record<string, string> = {
  [ITEMS.home]: '홈',
  [ITEMS.radio]: '라디오',
  [ITEMS.category]: '카테고리',
  [ITEMS.recent]: '최근청취',
};

export async function extractPickleWeeklyData(params: {
  token: string;
  selectedItems: Set<string>;
  dates: string[];
  onProgress: (p: ExtractionProgress) => void;
}): Promise<WeeklyExtractionResult> {
  const { token, selectedItems, dates, onProgress } = params;
  const api = createPickleApi(token);

  const needsDaily =
    selectedItems.has(ITEMS.cumUser) ||
    selectedItems.has(ITEMS.cumGuest) ||
    selectedItems.has(ITEMS.cumMember) ||
    selectedItems.has(ITEMS.newUser);
  const menuItems = Object.keys(MENU_TAB).filter((i) => selectedItems.has(i));
  const needsHit = menuItems.length > 0;

  const callsPerDate = (needsDaily ? 1 : 0) + (needsHit ? 1 : 0);
  const total = dates.length * callsPerDate;
  let completed = 0;

  const results: WeeklyExtractionResult = {};

  for (const sheetDate of dates) {
    results[sheetDate] = {};
    const range = weekRange(sheetDate);
    const lastDay = range.toDate;

    if (needsDaily) {
      onProgress({
        completed,
        total,
        currentLabel: `${sheetDate} — 사용자 일간`,
      });
      const rows = await fetchUserDaily(api, range);
      // API가 요청 범위 밖 날짜도 함께 반환하는 경우가 있어 주차 범위로 한 번 더 거른다.
      const inRange = rows.filter(
        (r) => r.date >= range.fromDate && r.date <= range.toDate
      );
      const lastRows = inRange.filter((r) => r.date === lastDay);
      const member = lastRows.reduce((s, r) => s + (r.memberCnt || 0), 0);
      const guest = lastRows.reduce((s, r) => s + (r.guestCnt || 0), 0);
      const newCnt = inRange.reduce(
        (s, r) => s + (r.newMemberCnt || 0) + (r.newGuestCnt || 0),
        0
      );
      if (selectedItems.has(ITEMS.cumUser))
        results[sheetDate][ITEMS.cumUser] = member + guest;
      if (selectedItems.has(ITEMS.cumGuest))
        results[sheetDate][ITEMS.cumGuest] = guest;
      if (selectedItems.has(ITEMS.cumMember))
        results[sheetDate][ITEMS.cumMember] = member;
      if (selectedItems.has(ITEMS.newUser))
        results[sheetDate][ITEMS.newUser] = newCnt;
      completed++;
    }

    if (needsHit) {
      onProgress({
        completed,
        total,
        currentLabel: `${sheetDate} — 메뉴 터치`,
      });
      const rows = await fetchHitHomeTab(api, range);
      for (const item of menuItems) {
        results[sheetDate][item] = rows
          .filter((r) => r.tabName === MENU_TAB[item])
          .reduce((s, r) => s + (r.hitCnt || 0), 0);
      }
      completed++;
    }
  }

  onProgress({ completed, total, currentLabel: '완료' });
  return results;
}
