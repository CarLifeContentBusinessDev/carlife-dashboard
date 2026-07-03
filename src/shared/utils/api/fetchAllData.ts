import type { AxiosInstance } from 'axios';
import type {
  CurationListIdProps,
  curationDetailEpisodeProps,
  curationDetailProps,
  usingChannelProps,
  usingCurationExcelProps,
  usingDataProps,
} from '@/shared/types/pickleProdContents';
import { mapCurationStatus } from '@/shared/utils/format/statusMapper';
import { api } from './api';

const SIZE = 10000;
const CURATIONSIZE = 100;

function isAbortOrCanceledError(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err.name === 'AbortError' || err.name === 'CanceledError')
  );
}

export async function fetchAllData(
  category: 'channel',
  setProgress: (message: string) => void,
  signal?: AbortSignal,
  apiInstance?: AxiosInstance
): Promise<usingChannelProps[]>;
export async function fetchAllData(
  category: 'episode',
  setProgress: (message: string) => void,
  signal?: AbortSignal,
  apiInstance?: AxiosInstance
): Promise<usingDataProps[]>;

export async function fetchAllData(
  category: string,
  setProgress: (message: string) => void,
  signal?: AbortSignal,
  apiInstance: AxiosInstance = api
): Promise<(usingDataProps | usingChannelProps)[]> {
  try {
    if (signal?.aborted) {
      return [];
    }

    const firstRes = await apiInstance.get(
      `/admin/${category}?page=1&size=${SIZE}`,
      {
        signal,
      }
    );

    const totalCount = firstRes.data.data.pageInfo.totalCount;
    const totalPages = Math.ceil(totalCount / SIZE);

    let allData: (usingDataProps | usingChannelProps)[] = [];

    for (let page = 1; page <= totalPages; page++) {
      if (signal?.aborted) {
        return [];
      }

      setProgress(`${Math.round((page / totalPages / 2) * 100)}%`);
      const res = await apiInstance.get(
        `/admin/${category}?page=${page}&size=${SIZE}`,
        { signal }
      );

      const dataList = res.data.data.dataList;

      allData = allData.concat(dataList);
    }

    if (category === 'channel') {
      const channelData = allData as usingChannelProps[];

      for (let i = 0; i < channelData.length; i++) {
        if (signal?.aborted) {
          return [];
        }

        const channel = channelData[i];

        try {
          setProgress(`${Math.round(50 + (i / channelData.length) * 50)}%`);

          const episodeRes = await apiInstance.get(
            `/admin/episode?page=1&size=1&channelId=${channel.channelId}&withPlaylists=Y`,
            { signal }
          );

          const episodes = episodeRes.data.data.dataList;
          const totalEpisodeCount = Number(
            episodeRes.data?.data?.pageInfo?.totalCount ?? 0
          );
          channel.episodeCount = totalEpisodeCount;

          if (episodes && episodes.length > 0) {
            channel.dispDtime = episodes[0].dispDtime || '';
          } else {
            channel.dispDtime = '';
          }
        } catch (err) {
          if (isAbortOrCanceledError(err)) {
            return [];
          }
          console.error(`채널 ${channel.channelId}의 에피소드 조회 실패:`, err);
          channel.episodeCount = 0;
          channel.dispDtime = '';
        }
      }
    }

    return allData;
  } catch (err) {
    if (isAbortOrCanceledError(err)) {
      return [];
    }
    console.error('데이터 API 가져오기 실패:', err);
    return [];
  }
}

export async function fetchAllCurationData(
  apiInstance: AxiosInstance = api
): Promise<usingCurationExcelProps[]> {
  try {
    const firstRes = await apiInstance.get(
      `/admin/curation?page=1&size=${CURATIONSIZE}&periodType=ALL`
    );

    const totalCount = firstRes.data.data.pageInfo.totalCount;
    const totalPages = Math.ceil(totalCount / CURATIONSIZE);
    let curationIds: CurationListIdProps[] = [];

    for (let page = 1; page <= totalPages; page++) {
      const curationListRes = await apiInstance.get(
        `/admin/curation?page=${page}&size=${CURATIONSIZE}&periodType=ALL`
      );
      const pageCurationIds = curationListRes.data.data.dataList.map(
        (item: { curationId: number }) => ({ curationId: item.curationId })
      );
      curationIds = curationIds.concat(pageCurationIds);
    }

    const allCurationData: usingCurationExcelProps[] = [];

    for (const { curationId } of curationIds) {
      const detailRes = await apiInstance.get(
        `/admin/curation/${curationId}`,
        {}
      );
      const detailData = detailRes.data.data as curationDetailProps;

      const episodes: curationDetailEpisodeProps[] = detailData.episodes || [];

      const baseCurationData = {
        thumbnailTitle: detailData.thumbnailTitle ?? '',
        curationType: detailData.curationType,
        curationName: detailData.curationName,
        curationDesc: detailData.curationDesc,
        activeState: detailData.usageYn ?? '',
        exhibitionState: mapCurationStatus(detailData.status ?? ''),
        field: detailData.field ?? '',
        section: detailData.section ?? undefined,
        dispStartDtime: detailData.dispStartDtime,
        dispEndDtime: detailData.dispEndDtime,
        curationCreatedAt: detailData.createdAt,
      };

      const creatorName = detailData.creatorName ?? '';

      if (episodes.length === 0) {
        allCurationData.push({
          ...baseCurationData,
          channelId: 0,
          episodeId: 0,
          usageYn: '',
          channelName: '',
          episodeName: '',
          dispDtime: '',
          createdAt: '',
          playTime: 0,
          likeCnt: 0,
          listenCnt: 0,
          uploader: creatorName,
        });
      } else {
        for (const episode of episodes) {
          allCurationData.push({
            ...baseCurationData,
            channelId: episode.channelId ?? 0,
            episodeId: episode.episodeId ?? 0,
            usageYn: episode.usageYn ?? '',
            channelName: episode.channelName ?? '',
            episodeName: episode.episodeName ?? '',
            dispDtime: episode.dispDtime ?? '',
            createdAt: episode.createdAt ?? '',
            playTime: episode.playTime ?? 0,
            likeCnt: episode.likeCnt ?? 0,
            listenCnt: episode.listenCnt ?? 0,
            uploader: creatorName,
          });
        }
      }
    }

    return allCurationData;
  } catch (err) {
    console.error('큐레이션 데이터 API 가져오기 실패:', err);
    return [];
  }
}
