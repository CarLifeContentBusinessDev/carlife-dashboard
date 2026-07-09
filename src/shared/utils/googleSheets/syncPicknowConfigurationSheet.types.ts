export interface PicknowSelection {
  client: string;
  oem: string;
  device: string;
}

export interface PicknowOemDevice {
  oemDeviceSeq: number;
  oem: string;
  device: string;
}

export interface PicknowBookmarkListItem {
  bookmarkSeq: number;
  title: string;
  faviconFullPath: string;
  domain: string;
  url: string;
  countryCd: string;
  defaultYn: string;
  recommendedYn: string;
  activeYn: string;
  configurationYn: string;
  payYn: string;
  appType: string;
  categoryCd: string;
  categoryCdNm: string;
  createdAt: string;
  modifiedAt: string;
  oemDevices: PicknowOemDevice[];
}

export interface PicknowUrlConfigRangeItem {
  from: string;
  to: string;
  value: string;
}

export interface PicknowUrlConfigVersion {
  zoomFactor?: {
    default?: string;
    portrait?: PicknowUrlConfigRangeItem[];
    landscape?: PicknowUrlConfigRangeItem[];
  };
  userAgent?: {
    default?: string;
    portrait?: PicknowUrlConfigRangeItem[];
    landscape?: PicknowUrlConfigRangeItem[];
  };
  whiteList?: string[];
  blackList?: string[];
  duplicateDomainList?: string[];
  unSupportedDomainList?: Record<string, string[]>;
  mobilePage?: boolean;
  pinchZoom?: boolean;
  supportNewTab?: boolean;
  mouseOnlyPage?: boolean;
  sendStringOnEnter?: boolean;
}

export interface PicknowBookmarkDetail {
  bookmarkSeq: number;
  title: string;
  url: string;
  countryCd: string;
  domainSeq: number;
  domain: string;
  faviconFullPath: string;
  defaultYn: string;
  recommendedYn: string;
  urlActiveYn: string;
  domainActiveYn: string;
  payYn: string;
  // 버전(웹뷰 버전 등) 키로 감싸져 있으며, 'default' 키가 공통 설정으로 항상 존재한다.
  urlConfig: Record<string, PicknowUrlConfigVersion>;
  appType: string;
  categoryCd: string;
  categoryCdNm: string;
  creatorSeq: number;
  creatorName: string;
  createdAt: string;
  modifierSeq: number;
  modifierName: string;
  modifiedAt: string;
  oemDeviceMappings: PicknowOemDevice[];
  keyword: string | null;
  remark: string;
  binaryCds: string[];
  configurationYn?: string;
}

export interface BinaryCodeItem {
  comCodeSeq: number;
  comCodeGroupCd: string;
  comCodeCd: string;
  comCodeName: string;
  sortOrder: number;
  usageYn: string;
  attribute1: string;
  attribute2: string;
  attribute3: string;
}

export interface PageInfoResponse {
  page?: number;
  size?: number;
  totalCount?: number;
}

export type ListPayload<T> =
  | T[]
  | {
      dataList?: T[];
      items?: T[];
      list?: T[];
      content?: T[];
      rows?: T[];
    };

export interface BinaryCodeResponse {
  resultCode: string;
  resultMessage: string;
  data: ListPayload<BinaryCodeItem>;
}

export interface PicknowOemDeviceResponse {
  resultCode: string;
  resultMessage: string;
  data: ListPayload<PicknowOemDevice>;
}

export interface PagedListResponse<T> {
  resultCode: string;
  resultMessage: string;
  data: ListPayload<T> & {
    pageInfo?: PageInfoResponse;
  };
}

export interface PicknowBookmarkDetailResponse {
  resultCode: string;
  resultMessage: string;
  data: PicknowBookmarkDetail;
}

export interface SyncPicknowConfigurationResult {
  sheetName: string;
  selectedCount: number;
  matchedCount: number;
  writtenCount: number;
  failedBookmarkSeqs: number[];
  skippedSelections: PicknowSelection[];
}
