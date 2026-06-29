// 픽조이 주간지표 시트의 항목명 → API 매핑 설정
// 실제 시트 C열의 항목명과 다르면 이 파일의 값을 수정하세요

import type { PickjoyOEMParams } from './pickjoyOEMConfig';

export interface WeeklyTopContentConfig {
  itemName: string;
  oemParamsList: PickjoyOEMParams[];
}

// 집계 항목: 항목명 → API 응답 필드
export const PICKJOY_WEEKLY_ITEM_KEYS = {
  registeredVinCount: '누적 사용자 수',
  wau: 'WAU',
  totalClicks: '총 클릭 수',
  contentClicks: '총 콘텐츠 클릭수',
  contentPlayTime: '총 콘텐츠 사용시간(분)',
} as const;

// 주간 인기 콘텐츠: 시트 항목명 → OEM 파라미터 목록 (합산 후 1위)
export const PICKJOY_WEEKLY_TOP_CONTENT: WeeklyTopContentConfig[] = [
  {
    itemName: '주간 인기 콘텐츠',
    oemParamsList: [
      { manufacturerSeq: 1, deviceSeq: 1, companySeq: 1 }, // Aurora 1 (Renault)
      { manufacturerSeq: 1, deviceSeq: 8, companySeq: 1 }, // Aurora 2 (Renault)
    ],
  },
];
