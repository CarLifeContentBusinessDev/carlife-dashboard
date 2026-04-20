import type { AxiosInstance } from 'axios';
import type { usingChannelProps, usingDataProps } from '../types/type';
import { api } from './api';
import { getGoogleToken } from './auth';
import { getExcelData } from './updateExcel';

export async function getNewData(
  token: string,
  accessToken: string,
  setProgress: (message: string) => void,
  category: 'channel',
  apiInstance?: AxiosInstance,
  spreadsheetId?: string
): Promise<usingChannelProps[]>;
export async function getNewData(
  token: string,
  accessToken: string,
  setProgress: (message: string) => void,
  category: 'episode',
  apiInstance?: AxiosInstance,
  spreadsheetId?: string
): Promise<usingDataProps[]>;

export async function getNewData(
  token: string,
  accessToken: string,
  setProgress: (message: string) => void,
  category: 'episode' | 'channel',
  apiInstance: AxiosInstance = api,
  spreadsheetId?: string
): Promise<(usingDataProps | usingChannelProps)[]> {
  const EPISODE_FETCH_CONCURRENCY = 10;

  const excelData = await getExcelData(
    token,
    category,
    undefined,
    spreadsheetId
  );

  const size = 1000;
  const firstRes = await apiInstance.get(
    `/admin/${category}?page=1&size=${size}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  const totalCount = firstRes.data.data.pageInfo.totalCount;
  const totalPages = Math.ceil(totalCount / size);

  let progress = 0;
  const addProgress = () => {
    progress += 100 / totalCount;
    setProgress(`${Math.min(100, Math.round(progress))}%`);
  };

  let allApiData: (usingDataProps | usingChannelProps)[] = [];

  for (let page = 1; page <= totalPages; page++) {
    const res = await apiInstance.get(
      `/admin/${category}?page=${page}&size=${size}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    addProgress();
    const pageData = res.data.data.dataList;
    allApiData = allApiData.concat(pageData);
  }

  // Excel에 있는 ID 목록 추출
  const excelIds = new Set(
    excelData.map((item) =>
      'episodeId' in item ? item.episodeId : item.channelId
    )
  );

  // Excel에 없는 데이터만 필터링
  const newData = allApiData.filter((item) => {
    const currentId =
      'episodeId' in item
        ? item.episodeId
        : 'channelId' in item
          ? item.channelId
          : 0;
    return !excelIds.has(currentId);
  });

  if (category === 'channel') {
    const channels = newData as usingChannelProps[];

    if (channels.length > 0) {
      let completed = 0;
      const updateChannelProgress = () => {
        const percent = Math.round((completed / channels.length) * 100);
        setProgress(`최근 에피소드 업로드일 조회 중... ${percent}%`);
      };

      const fetchLatestEpisodeDispDtime = async (
        channel: usingChannelProps
      ) => {
        try {
          const episodeRes = await apiInstance.get(
            `/admin/episode?page=1&size=1&channelId=${channel.channelId}&withPlaylists=Y`,
            {
              headers: { Authorization: `Bearer ${accessToken}` },
            }
          );

          const latestEpisode = episodeRes.data?.data?.dataList?.[0];
          const totalEpisodeCount = Number(
            episodeRes.data?.data?.pageInfo?.totalCount ?? 0
          );
          channel.episodeCount = totalEpisodeCount;
          channel.dispDtime = latestEpisode?.dispDtime ?? '';
        } catch (err) {
          console.error(
            `채널 ${channel.channelId}의 최근 에피소드 조회 실패:`,
            err
          );
          channel.episodeCount = 0;
          channel.dispDtime = '';
        } finally {
          completed += 1;
          updateChannelProgress();
        }
      };

      for (let i = 0; i < channels.length; i += EPISODE_FETCH_CONCURRENCY) {
        const chunk = channels.slice(i, i + EPISODE_FETCH_CONCURRENCY);
        await Promise.all(
          chunk.map((channel) => fetchLatestEpisodeDispDtime(channel))
        );
      }
    }
  }

  return newData;
}

export async function getNewDataWithExcel(
  setProgress?: (message: string) => void,
  apiInstance: AxiosInstance = api,
  spreadsheetId?: string
): Promise<usingDataProps[]> {
  const batchSize = 10000;

  // 전체 진행률 계산 (엑셀 조회 20%, API 조회 60%, 변경 확인은 외부에서 20%)
  const updateProgress = (
    stage: string,
    stageProgress: number,
    stageWeight: number,
    stageStart: number
  ) => {
    const overall = Math.round(
      stageStart + (stageProgress * stageWeight) / 100
    );
    setProgress?.(`[전체 ${overall}%] ${stage}`);
  };

  updateProgress('엑셀 데이터 조회 중...', 0, 20, 0);

  // 1. 첫 페이지 조회와 엑셀 데이터 조회를 병렬로 실행
  const [firstRes, allExcelData] = await Promise.all([
    apiInstance.get(`/admin/episode?page=1&size=1`),
    getExcelData('', 'episode', undefined, spreadsheetId),
  ]);

  const totalCount = firstRes.data.data.pageInfo.totalCount;
  const totalPages = Math.ceil(totalCount / batchSize);

  updateProgress('API 데이터 조회 중... 0%', 0, 60, 20);

  // 2. 동시 연결 풀을 사용한 병렬 처리 (하나 완료되면 즉시 다음 시작)
  const allApiData: usingDataProps[] = [];
  let completedPages = 0;
  const concurrentLimit = 15;

  const fetchPage = async (page: number): Promise<usingDataProps[]> => {
    try {
      const res = await apiInstance.get(
        `/admin/episode?page=${page}&size=${batchSize}`
      );
      completedPages++;
      const stageProgress = Math.round((completedPages / totalPages) * 100);
      updateProgress(
        `API 데이터 조회 중... ${stageProgress}%`,
        stageProgress,
        60,
        20
      );
      return res.data.data.dataList || [];
    } catch (err) {
      completedPages++;
      console.error(`페이지 ${page} 조회 실패:`, err);
      return [];
    }
  };

  // 동시성 제한이 있는 병렬 실행
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

  for (let i = 0; i < pages.length; i += concurrentLimit) {
    await getGoogleToken();

    const chunk = pages.slice(i, i + concurrentLimit);
    const results = await Promise.all(chunk.map((page) => fetchPage(page)));
    results.forEach((data) => allApiData.push(...data));
  }

  // 3. Excel에 없는 데이터만 필터링
  const excelIds = new Set(allExcelData.map((item) => item.episodeId));
  const newEpisodes = allApiData.filter(
    (item) => !excelIds.has(item.episodeId)
  );

  return newEpisodes;
}
