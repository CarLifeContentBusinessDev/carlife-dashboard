import type { AxiosInstance } from 'axios';
import type {
  fastDetailProps,
  fastListItemProps,
  fastStatsProps,
  ProdFastRow,
} from '@/shared/types/pickleProdContents';
import { api } from './api';
import { executeWithConcurrencyLimit } from './requestPool';

const LIST_SIZE = 100;
const LIST_BASE_PARAMS = `usageFilter=ALL&hlsStatus=ALL&sortBy=CREATED_AT&sortDirection=DESC&size=${LIST_SIZE}`;

export function mapFastToRow(
  item: fastListItemProps,
  detail: fastDetailProps | null,
  stats: fastStatsProps | null
): ProdFastRow {
  const hls = detail?.hlsStatus ?? item.hlsStatus;
  const contentList = detail?.contentList ?? [];
  const channelNames = Array.from(
    new Set(contentList.map((c) => c.channelName).filter(Boolean))
  );

  return {
    fastId: item.fastId,
    usageYn: item.usageYn ?? '',
    fastName: item.fastName ?? '',
    includedChannelNames: channelNames.join(', '),
    hlsStatus: hls?.status ?? '',
    episodeCount: detail?.episodeCount ?? item.episodeCount ?? 0,
    createdAt: item.createdAt ?? '',
    dispStartDtime: item.dispStartDtime ?? '',
    dispEndDtime: item.dispEndDtime ?? '',
    generationStartedAt: hls?.generationStartedAt ?? '',
    generationEndedAt: hls?.generationEndedAt ?? '',
    totalGenerationSeconds: hls?.elapsedSeconds ?? 0,
    touchCount: stats?.touchCount ?? 0,
    playRequestCount: stats?.playRequestCount ?? 0,
    streamUrl: item.streamUrl ?? '',
    thumbnailUrl: '',
  };
}

export async function fetchFastListItems(
  apiInstance: AxiosInstance = api,
  signal?: AbortSignal
): Promise<fastListItemProps[]> {
  const firstRes = await apiInstance.get(
    `/admin/fast?${LIST_BASE_PARAMS}&page=1`,
    { signal }
  );
  const { dataList, pageInfo } = firstRes.data.data as {
    dataList: fastListItemProps[];
    pageInfo: { totalCount: number };
  };

  const totalPages = Math.ceil(pageInfo.totalCount / LIST_SIZE);
  let listItems: fastListItemProps[] = [...dataList];

  if (totalPages > 1) {
    const pagePromises = Array.from({ length: totalPages - 1 }, (_, i) =>
      apiInstance.get(`/admin/fast?${LIST_BASE_PARAMS}&page=${i + 2}`, {
        signal,
      })
    );
    const results = await Promise.all(pagePromises);
    results.forEach((res) => {
      listItems = listItems.concat(
        (res.data.data as { dataList: fastListItemProps[] }).dataList
      );
    });
  }

  return listItems;
}

/**
 * 목록 아이템별로 상세(/admin/fast/:id)와 통계(/admin/fast/:id/stats)를
 * 호출해 표시용 행으로 변환한다. (동시 요청 5개 제한)
 */
export async function enrichFastRows(
  items: fastListItemProps[],
  apiInstance: AxiosInstance = api,
  signal?: AbortSignal,
  setProgress?: (message: string) => void
): Promise<ProdFastRow[]> {
  let done = 0;
  const total = items.length;

  const tasks = items.map((item) => async (): Promise<ProdFastRow> => {
    const [detailRes, statsRes] = await Promise.allSettled([
      apiInstance.get(`/admin/fast/${item.fastId}`, { signal }),
      apiInstance.get(`/admin/fast/${item.fastId}/stats`, { signal }),
    ]);

    const detail =
      detailRes.status === 'fulfilled'
        ? (detailRes.value.data.data as fastDetailProps)
        : null;
    const stats =
      statsRes.status === 'fulfilled'
        ? (statsRes.value.data.data as fastStatsProps)
        : null;

    done += 1;
    if (setProgress && total > 0) {
      setProgress(`${Math.min(100, Math.round((done / total) * 100))}%`);
    }

    return mapFastToRow(item, detail, stats);
  });

  const settled = await executeWithConcurrencyLimit(tasks, { concurrency: 5 });

  return settled
    .filter(
      (r): r is PromiseFulfilledResult<ProdFastRow> => r.status === 'fulfilled'
    )
    .map((r) => r.value);
}

/**
 * FAST 전체 목록 + 건별 상세/통계를 조회해 표시용 행 배열로 반환한다.
 */
export async function fetchAllFastData(
  apiInstance: AxiosInstance = api,
  signal?: AbortSignal,
  setProgress?: (message: string) => void
): Promise<ProdFastRow[]> {
  const listItems = await fetchFastListItems(apiInstance, signal);
  return enrichFastRows(listItems, apiInstance, signal, setProgress);
}
