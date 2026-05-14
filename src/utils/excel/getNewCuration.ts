import type { AxiosInstance } from 'axios';
import type {
  curationDetailEpisodeProps,
  curationDetailProps,
  curationListItemProps,
  usingCurationExcelProps,
} from '../../types/pickleProdContents';
import { api } from '../api/api';
import { mapCurationStatus } from '../format/statusMapper';
import { getCurationExcelData } from './updateCuration';

export async function getNewCurationData(
  token: string,
  setProgress: (message: string) => void,
  apiInstance: AxiosInstance = api,
  spreadsheetId?: string,
  sheetName?: string
): Promise<usingCurationExcelProps[]> {
  const excelData = await getCurationExcelData(
    token,
    spreadsheetId || import.meta.env.VITE_SPREADSHEET_ID,
    sheetName
  );
  const existingEpisodeIds = new Set(
    excelData.map((item) => item.episodeId ?? 0).filter((id) => id > 0)
  );

  const size = 100;
  const firstRes = await apiInstance.get(
    `/admin/curation?page=1&size=${size}&periodType=ALL`
  );
  const totalCount = firstRes.data.data.pageInfo.totalCount;
  const totalPages = Math.ceil(totalCount / size);

  let progress = 0;
  const addProgress = () => {
    progress += 100 / totalCount;
    setProgress(`${Math.min(100, Math.round(progress))}%`);
  };

  let allApiData: curationListItemProps[] = [];

  for (let page = 1; page <= totalPages; page++) {
    const res = await apiInstance.get(
      `/admin/curation?page=${page}&size=${size}&periodType=ALL`
    );
    const pageData = res.data.data.dataList;
    allApiData = allApiData.concat(pageData);
  }

  let allEpiData: usingCurationExcelProps[] = [];

  for (let i = 0; i < allApiData.length; i++) {
    const listItem = allApiData[i];
    const epiRes = await apiInstance.get(
      `/admin/curation/${listItem.curationId}`
    );
    addProgress();
    const detailData = epiRes.data.data as curationDetailProps;
    const episodes: curationDetailEpisodeProps[] = detailData.episodes || [];

    const baseCurationData: Omit<
      usingCurationExcelProps,
      | 'channelId'
      | 'episodeId'
      | 'usageYn'
      | 'channelName'
      | 'episodeName'
      | 'dispDtime'
      | 'createdAt'
      | 'playTime'
      | 'likeCnt'
      | 'listenCnt'
      | 'uploader'
    > = {
      thumbnailTitle: detailData.thumbnailTitle ?? '',
      curationType: detailData.curationType,
      curationName: detailData.curationName,
      curationDesc: detailData.curationDesc,
      // 활성 상태: usageYn (Y/N)
      activeState: detailData.usageYn ?? listItem.usageYn ?? '',
      // 전시 상태: status (ACTIVE / INACTIVE / ACTIVE_NONE_DISPLAY)
      exhibitionState: mapCurationStatus(
        detailData.status ?? listItem.status ?? ''
      ),
      field: detailData.field ?? '',
      section: detailData.section ?? 0,
      dispStartDtime: detailData.dispStartDtime,
      dispEndDtime: detailData.dispEndDtime,
      curationCreatedAt: detailData.createdAt,
    };

    // 게시자 정보: 큐레이션 생성자
    const creatorName = detailData.creatorName ?? listItem.creatorName ?? '';

    if (episodes.length === 0) {
      // 에피소드 없는 큐레이션도 한 행으로 포함
      allEpiData.push({
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
        allEpiData.push({
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

  // 에피소드 있는 항목: episodeId 기준 신규 필터
  // 에피소드 없는 항목: curationName 기준 중복 제거
  const existingCurationNames = new Set(
    excelData.map((item) => item.curationName)
  );
  const newEpisodes = allEpiData.filter((item) => {
    const episodeId = item.episodeId ?? 0;
    if (episodeId === 0) {
      return !existingCurationNames.has(item.curationName);
    }
    return !existingEpisodeIds.has(episodeId);
  });

  return newEpisodes;
}
