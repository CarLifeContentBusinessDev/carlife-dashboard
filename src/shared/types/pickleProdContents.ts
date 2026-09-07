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

export interface fastHlsStatusProps {
  exportId: string;
  status: string;
  complete: boolean;
  cancelRequested: boolean | null;
  progressPercent: number;
  generationStartedAt: string | null;
  elapsedSeconds: number | null;
  generationEndedAt: string | null;
}

export interface fastListItemProps {
  fastId: number;
  usageYn: string;
  liveTagYn: string;
  fastName: string;
  fastDesc: string;
  contentType: string;
  thumbnailUrlAaos: string;
  thumbnailUrlAos: string;
  thumbnailUrl: string;
  thumbnailUrlRect: string;
  episodeCount: number;
  creatorName: string;
  createdAt: string;
  dispStartDtime: string;
  dispEndDtime: string;
  streamId: string;
  streamUrl: string;
  hlsStatus: fastHlsStatusProps;
}

export interface fastContentItemProps {
  episodeId: number;
  channelId: number;
  channelName: string;
  language: string;
  interfaceType: string;
  episodeType: string;
  episodeName: string;
  playTime: number;
  vendorName: string;
  thumbnailUrl: string;
  audioUrl: string;
  likeCnt: number;
  listenCnt: number;
  lastUpdateDtime: string;
  dispDtime: string;
  usageYn: string;
  createdAt: string;
}

export interface fastDetailProps extends fastListItemProps {
  totalPlayTime: number;
  previewStreamUrl: string;
  contentTotalCount: number;
  contentList: fastContentItemProps[];
}

export interface fastStatsProps {
  playRequestCount: number;
  touchCount: number;
}

export interface ProdFastRow {
  fastId: number;
  usageYn: string;
  fastName: string;
  includedChannelNames: string;
  hlsStatus: string;
  episodeCount: number;
  createdAt: string;
  dispStartDtime: string;
  dispEndDtime: string;
  generationStartedAt: string;
  generationEndedAt: string;
  totalGenerationSeconds: number;
  likeCnt: number;
  playRequestCount: number;
  streamUrl: string;
  thumbnailUrl: string;
}
