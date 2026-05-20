export interface usingDataProps {
  episodeId: number;
  usageYn: string;
  channelName: string;
  episodeName: string;
  dispDtime: string;
  createdAt: string;
  likeCnt: number;
  listenCnt: number;
  playTime: number;
  thumbnailUrl: string;
  audioUrl: string;
  channelId: number;
}

export interface usingChannelProps {
  channelId: number;
  interfaceUrl: string;
  usageYn: string;
  channelName: string;
  channelTypeName: string;
  interfaceType: string;
  categoryId: number;
  categoryName: string;
  episodeCount?: number;
  vendorName: string;
  likeCnt: number;
  listenCnt: number;
  createdAt: string;
  dispDtime: string;
  thumbnailUrl: string;
}

export interface CurationListIdProps {
  curationId: number;
}

export interface usingCurationProps {
  curationId: number;
  curationType: string;
  curationName: string;
  curationDesc: string;
  dispStartDtime: string;
  dispEndDtime: string;
  createdAt: string;
  episodes?: curationEpisodesProps[];
}

export interface curationListItemProps extends usingCurationProps {
  usageYn?: string;
  status?: string;
  creatorName?: string;
  thumbnailUrlSquare?: string;
  thumbnailUrlRect?: string;
}

export interface curationDetailEpisodeProps {
  channelId?: number;
  episodeId?: number;
  usageYn?: string;
  channelName?: string;
  episodeName?: string;
  dispDtime?: string;
  createdAt?: string;
  playTime?: number;
  likeCnt?: number;
  listenCnt?: number;
}

export interface curationDetailProps {
  thumbnailUrlSquare?: string;
  thumbnailUrlRect?: string;
  thumbnailTitle?: string;
  curationType: string;
  curationName: string;
  curationDesc: string;
  usageYn?: string;
  status?: string;
  field?: string;
  section?: number;
  dispStartDtime: string;
  dispEndDtime: string;
  createdAt: string;
  creatorName?: string;
  episodes?: curationDetailEpisodeProps[];
}

export interface usingCurationExcelProps {
  thumbnailTitle?: string;
  thumbnailUrlSquare?: string;
  thumbnailUrlRect?: string;
  field?: string;
  section?: number;
  activeState?: string;
  exhibitionState?: string;
  curationType: string;
  curationName: string;
  curationDesc: string;
  dispStartDtime: string;
  dispEndDtime: string;
  curationCreatedAt: string;
  channelId?: number;
  episodeId?: number;
  usageYn?: string;
  channelName?: string;
  episodeName?: string;
  dispDtime?: string;
  createdAt?: string;
  playTime?: number;
  likeCnt?: number;
  listenCnt?: number;
  uploader?: string;
}

export type ProdCurationRow = usingCurationExcelProps & { curationId: number };

export interface curationEpisodesProps {
  channelId: number;
  episodeId: number;
  usageYn: string;
  channelName: string;
  episodeName: string;
  dispDtime: string;
  createdAt: string;
  playTime: number;
  likeCnt: number;
  listenCnt: number;
}
