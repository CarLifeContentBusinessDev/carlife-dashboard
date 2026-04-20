import type { AxiosInstance } from 'axios';
import type { usingChannelProps, usingDataProps } from '../types/type';
import { api } from './api';
import { getGoogleToken, getSheetsClient } from './auth';
import { getExcelData } from './updateExcel';
import { buildSheetRange } from './sheetRange';

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
  spreadsheetId?: string,
  sheetName?: string
): Promise<usingDataProps[]> {
  const targetSpreadsheetId =
    spreadsheetId || import.meta.env.VITE_SPREADSHEET_ID;
  const batchSize = 1000;

  // 1. 엑셀 B2 셀에서 총 개수 읽기 ("총 284168개" → 284168)
  setProgress?.('개수 비교 중...');
  await getGoogleToken();
  const sheets = getSheetsClient();
  const countRes = await sheets.spreadsheets.values.get({
    spreadsheetId: targetSpreadsheetId,
    range: buildSheetRange(sheetName || 'Sheet1', 'B2'),
  });

  const rawCount = countRes.result.values?.[0]?.[0] as string | undefined;
  const excelCount = rawCount ? Number(rawCount.replace(/[^0-9]/g, '')) : 0;

  // 2. API 총 개수
  const firstRes = await apiInstance.get('/admin/episode?page=1&size=1');
  const apiCount: number = firstRes.data.data.pageInfo.totalCount;

  // 3. 같으면 신규 없음
  if (!excelCount || excelCount >= apiCount) {
    return [];
  }

  // 4. 차이만큼만 API에서 가져오기 (API는 최신순 반환)
  const newCount = apiCount - excelCount;
  setProgress?.(`신규 에피소드 ${newCount}개 조회 중...`);

  const newEpisodes: usingDataProps[] = [];
  let page = 1;

  while (newEpisodes.length < newCount) {
    const res = await apiInstance.get(
      `/admin/episode?page=${page}&size=${batchSize}`
    );
    const { dataList } = res.data.data;
    const remaining = newCount - newEpisodes.length;
    newEpisodes.push(...(dataList as usingDataProps[]).slice(0, remaining));
    if ((dataList as usingDataProps[]).length < batchSize) break;
    page++;
  }

  return newEpisodes;
}
