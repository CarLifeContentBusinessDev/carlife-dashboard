import type { ProductGroup } from '@/feature/pickseries/types/pickSeriesTypes';

export const WEEKLY_PRODUCT_GROUPS: ProductGroup[] = [
  {
    id: 'pickle',
    label: '픽클',
    tabName: '픽클_주간지표',
    serverIds: ['pickle-prod'],
  },
  {
    id: 'picknow',
    label: '픽나우',
    tabName: '픽나우_주간지표',
    serverIds: ['picknow-kr-prod-kia', 'picknow-kr-prod', 'picknow-us-prod'],
  },
  {
    id: 'pickjoy',
    label: '픽조이',
    tabName: '픽조이_주간지표',
    serverIds: ['pickjoy'],
  },
];

export const OEM_PRODUCT_GROUPS: ProductGroup[] = [
  {
    id: 'pickle',
    label: '픽클',
    tabName: '픽클_OEM지표',
    serverIds: ['pickle-prod'],
    excludedItems: ['표준 편차', '재방문 비율'],
  },
  {
    id: 'picknow',
    label: '픽나우',
    tabName: '픽나우_OEM지표',
    serverIds: ['picknow-kr-prod-kia', 'picknow-kr-prod', 'picknow-us-prod'],
    excludedItems: ['표준 편차', '재방문 비율'],
  },
  {
    id: 'pickjoy',
    label: '픽조이',
    tabName: '픽조이_OEM지표',
    serverIds: ['pickjoy'],
    excludedItems: ['표준 편차'],
  },
];
