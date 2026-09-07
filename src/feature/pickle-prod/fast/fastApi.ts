import type { AxiosInstance } from 'axios';
import type {
  fastDetailProps,
  fastListItemProps,
  fastStatsProps,
  ProdFastRow,
} from '@/shared/types/pickleProdContents';
import { executeWithConcurrencyLimit } from '@/shared/utils/api/requestPool';

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
    likeCnt: 0,
    playRequestCount: stats?.playRequestCount ?? 0,
    streamUrl: item.streamUrl ?? '',
    thumbnailUrl: '',
  };
}

async function fetchFastListItems(
  apiInstance: AxiosInstance,
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

export async function loadAllFastRows(
  apiInstance: AxiosInstance,
  signal?: AbortSignal
): Promise<ProdFastRow[]> {
  const listItems = await fetchFastListItems(apiInstance, signal);

  const tasks = listItems.map((item) => async (): Promise<ProdFastRow> => {
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

    return mapFastToRow(item, detail, stats);
  });

  const settled = await executeWithConcurrencyLimit(tasks, { concurrency: 5 });

  return settled
    .filter(
      (r): r is PromiseFulfilledResult<ProdFastRow> => r.status === 'fulfilled'
    )
    .map((r) => r.value);
}
