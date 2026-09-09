export interface WeeklyTopContentConfig {
  itemName: string;
}

// 집계 항목: 항목명 → API 응답 필드
export const PICKJOY_WEEKLY_ITEM_KEYS = {
  registeredVinCount: '누적 사용자 수',
  wau: 'WAU',
  totalClicks: '총 클릭 수',
  contentClicks: '총 콘텐츠 클릭수',
  contentPlayTime: '총 콘텐츠 사용시간(분)',
} as const;

// 주간 인기 콘텐츠: 시트 항목명
export const PICKJOY_WEEKLY_TOP_CONTENT: WeeklyTopContentConfig[] = [
  { itemName: '주간 인기 콘텐츠' },
];

export interface WeeklyOEMInfo {
  name: string;
  availableFrom: string;
}

export const PICKJOY_WEEKLY_OEMS: WeeklyOEMInfo[] = [
  { name: 'AR1(Renault)', availableFrom: '2025.09' },
  { name: 'AR2(Renault)', availableFrom: '2026.01' },
];

// 주차 날짜(YYYY.MM.DD) 기준으로 데이터가 존재하는 OEM만 반환
export function getActiveWeeklyOEMs(sheetDate: string): WeeklyOEMInfo[] {
  const yearMonth = sheetDate.slice(0, 7); // 'YYYY.MM'
  return PICKJOY_WEEKLY_OEMS.filter((oem) => oem.availableFrom <= yearMonth);
}
