import type { usingChannelProps } from '@/shared/types/pickleProdContents';

/**
 * `/admin/channel` 응답의 `categoryList` / `vendorList` 배열을
 * 화면·엑셀에서 쓰는 평탄한 필드(`categoryId` / `categoryName` / `vendorName`)로 변환한다.
 * `categoryList` 원본은 UI 태그 렌더를 위해 그대로 유지한다.
 */
export function normalizeChannel(channel: usingChannelProps): usingChannelProps {
  const categories = channel.categoryList ?? [];
  const vendors = channel.vendorList ?? [];

  channel.categoryId = categories[0]?.categoryId ?? channel.categoryId ?? 0;
  channel.categoryName =
    categories.map((c) => c.categoryName).join(', ') ||
    channel.categoryName ||
    '';
  channel.vendorName =
    vendors.map((v) => v.vendorName).join(', ') || channel.vendorName || '';

  return channel;
}

/** 채널 목록 조회 시 항상 붙는 쿼리 파라미터 (page/size 앞에 `&`로 이어붙임) */
export const CHANNEL_LIST_QUERY =
  '&channelType=CHANNEL&sortBy=CREATED_AT&sortDirection=DESC';
