import type { AxiosInstance } from 'axios';
import { executeWithConcurrencyLimit } from '@/utils/api/requestPool';
import {
  getGoogleToken,
  getSheetsClient,
  initializeGoogleAPI,
} from '@/utils/auth/auth';
import { buildSheetRange } from '@/utils/excel/sheetRange';
import { preparePicknowConfigurationSheet } from './preparePicknowConfigurationSheet';
import { fetchSettingData } from './fetchSettingData';
import type { SettingRow } from './fetchSettingData';

export interface PicknowSelection {
  client: string;
  oem: string;
  device: string;
}

interface PicknowOemDevice {
  oemDeviceSeq: number;
  oem: string;
  device: string;
}

interface PicknowBookmarkListItem {
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

interface PicknowBookmarkDetail {
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
  urlConfig: {
    zoomFactor?: {
      default?: string;
      landscape?: Array<{
        from: string;
        to: string;
        value: string;
      }>;
    };
    userAgent?: {
      default?: string;
      landscape?: Array<{
        from: string;
        to: string;
        value: string;
      }>;
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
  };
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

interface BinaryCodeItem {
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

interface PageInfoResponse {
  page?: number;
  size?: number;
  totalCount?: number;
}

type ListPayload<T> =
  | T[]
  | {
      dataList?: T[];
      items?: T[];
      list?: T[];
      content?: T[];
      rows?: T[];
    };

const extractList = <T>(payload: ListPayload<T> | null | undefined): T[] => {
  if (Array.isArray(payload)) return payload;
  if (!payload) return [];

  const list =
    payload.dataList ??
    payload.items ??
    payload.list ??
    payload.content ??
    payload.rows;

  return Array.isArray(list) ? list : [];
};

const fetchAllPagedList = async <T>(
  apiInstance: AxiosInstance,
  url: string,
  params?: Record<string, string | number>
): Promise<T[]> => {
  const firstResponse = await apiInstance.get<PagedListResponse<T>>(url, {
    params: { ...params, page: 1, size: 1000 },
  });

  const firstData = firstResponse.data.data;
  const firstList = extractList(firstData);
  const totalCount = firstData?.pageInfo?.totalCount ?? firstList.length;

  if (totalCount <= firstList.length) {
    return firstList;
  }

  const pageSize = firstData?.pageInfo?.size || firstList.length || 1000;

  const totalPages = Math.ceil(totalCount / pageSize);
  const remainingPages = Array.from(
    { length: Math.max(totalPages - 1, 0) },
    (_, index) => index + 2
  );

  const remainingResults = await Promise.all(
    remainingPages.map(async (page) => {
      const response = await apiInstance.get<PagedListResponse<T>>(url, {
        params: { ...params, page, size: pageSize },
      });
      return extractList(response.data.data);
    })
  );

  return firstList.concat(...remainingResults);
};

interface BinaryCodeResponse {
  resultCode: string;
  resultMessage: string;
  data: ListPayload<BinaryCodeItem>;
}

interface PicknowOemDeviceResponse {
  resultCode: string;
  resultMessage: string;
  data: ListPayload<PicknowOemDevice>;
}

interface PagedListResponse<T> {
  resultCode: string;
  resultMessage: string;
  data: ListPayload<T> & {
    pageInfo?: PageInfoResponse;
  };
}

interface PicknowBookmarkDetailResponse {
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

const normalizeText = (value: string) =>
  value
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();

const compactText = (value: string) => normalizeText(value).replace(/\s+/g, '');

const matchesSelection = (
  selection: PicknowSelection,
  device: PicknowOemDevice
) => {
  const selectionOem = normalizeText(selection.oem);
  const selectionDevice = normalizeText(selection.device);
  const deviceOem = normalizeText(device.oem);
  const deviceDevice = normalizeText(device.device);

  if (selectionOem === deviceOem && selectionDevice === deviceDevice) {
    return true;
  }

  const compactSelection = `${compactText(selectionOem)}${compactText(selectionDevice)}`;
  const compactDevice = `${compactText(deviceOem)}${compactText(deviceDevice)}`;

  return compactSelection === compactDevice;
};

const toText = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'Y' : 'N';
  if (Array.isArray(value)) return value.join('\n');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const toBooleanText = (value: unknown): string => {
  if (typeof value === 'boolean') return value ? 'Y' : 'N';
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'y' || normalized === 'yes' || normalized === 'true') {
      return 'Y';
    }
    if (normalized === 'n' || normalized === 'no' || normalized === 'false') {
      return 'N';
    }
  }

  return toText(value);
};

const formatZoomFactorForSheet = (value: string): string => {
  const normalized = value.trim();
  if (!normalized) return '';

  const numericValue = Number(normalized);
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return normalized;
  }

  if (numericValue < 1) {
    const invertedValue = Math.round((1 / numericValue) * 10) / 10;
    return String(invertedValue);
  }

  return normalized;
};

const isYes = (value: unknown): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    return value.trim().toLowerCase() === 'y';
  }
  return false;
};

const parseResolution = (res: string) => {
  if (!res) return { width: 0, height: 0 };
  const m = res.match(/(\d+)\D+(\d+)/);
  if (!m) return { width: 0, height: 0 };
  return { width: parseInt(m[1], 10) || 0, height: parseInt(m[2], 10) || 0 };
};

const getValueFromConfig = (
  config: any,
  orientation: string | undefined,
  size: number
): { value: string; heightRange: string } => {
  if (config === undefined || config === null)
    return { value: '', heightRange: '' };

  const parsedConfig = (() => {
    if (typeof config !== 'string') {
      return config;
    }

    const trimmed = config.trim();
    if (!trimmed) {
      return '';
    }

    try {
      return JSON.parse(trimmed) as unknown;
    } catch {
      return trimmed;
    }
  })();

  if (typeof parsedConfig === 'string') {
    return { value: parsedConfig, heightRange: '' };
  }
  if (parsedConfig === undefined || parsedConfig === null) {
    return { value: '', heightRange: '' };
  }

  const orient = (orientation || '').toLowerCase();

  // if there is an orientation-specific array
  if (
    orient &&
    Array.isArray((parsedConfig as Record<string, unknown>)[orient])
  ) {
    for (const item of (parsedConfig as Record<string, unknown>)[
      orient
    ] as Array<{
      from: string;
      to: string;
      value: string;
    }>) {
      const from = parseInt(String(item.from || '0'), 10) || 0;
      const to = parseInt(String(item.to || '0'), 10) || 0;
      if (size >= from && size <= to) {
        return {
          value: String(item.value ?? ''),
          heightRange: `${from}~${to}`,
        };
      }
    }
  }

  // fallback to default
  const defaultValue = (parsedConfig as Record<string, unknown>).default;
  if (defaultValue !== undefined && defaultValue !== null) {
    return { value: String(defaultValue), heightRange: 'default' };
  }

  return { value: '', heightRange: '' };
};

const extractSheetText = (value: unknown): string => {
  if (value === null || value === undefined) return '';

  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return String(value).trim();
  }

  if (Array.isArray(value)) {
    return value.map(extractSheetText).filter(Boolean).join('\n');
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;

    const domainValue =
      extractSheetText(record.domain) ||
      extractSheetText(record.parentDomain) ||
      extractSheetText(record.host) ||
      extractSheetText(record.site);
    const keywordValues =
      record.keywordList ??
      record.keywords ??
      record.children ??
      record.subKeywords ??
      record.subKeywordList ??
      record.keyword ??
      record.items;

    if (domainValue && keywordValues) {
      const keywords = Array.isArray(keywordValues)
        ? keywordValues.map(extractSheetText).filter(Boolean)
        : [extractSheetText(keywordValues)].filter(Boolean);

      if (keywords.length > 0) {
        return `${domainValue}\n→ ${keywords.join(', ')}`;
      }
    }

    const preferredKeys = [
      'value',
      'text',
      'name',
      'label',
      'title',
      'domain',
      'url',
      'keyword',
      'pattern',
      'host',
      'rule',
    ];

    for (const key of preferredKeys) {
      const candidate = extractSheetText(record[key]);
      if (candidate) {
        return candidate;
      }
    }

    const primitiveValues = Object.values(record)
      .map(extractSheetText)
      .filter(Boolean);

    if (primitiveValues.length > 0) {
      return primitiveValues.join(' ');
    }

    return JSON.stringify(value);
  }

  return String(value).trim();
};

const stringifyBooleanArray = (values?: unknown[] | string | null): string => {
  if (!values) return '';
  if (Array.isArray(values)) {
    return values.map(extractSheetText).filter(Boolean).join('\n');
  }

  return extractSheetText(values);
};

const formatBlackListForSheet = (values?: unknown): string => {
  if (!values) return '';

  if (Array.isArray(values)) {
    return values.map(extractSheetText).filter(Boolean).join('\n');
  }

  const entries =
    typeof values === 'object' && values !== null
      ? Object.entries(values as Record<string, unknown>)
      : [];

  if (entries.length === 0) {
    return extractSheetText(values);
  }

  const lines: string[] = [];

  entries.forEach(([domain, keywords]) => {
    const domainText = extractSheetText(domain);
    if (!domainText) return;

    const keywordList = Array.isArray(keywords)
      ? keywords.map(extractSheetText).filter(Boolean)
      : [extractSheetText(keywords)].filter(Boolean);

    if (keywordList.length === 0) {
      lines.push(domainText);
      return;
    }

    lines.push(`${domainText}\n-> ${keywordList.join(', ')}`);
  });

  return lines.join('\n\n');
};

const formatUnSupportedDomainList = (
  map?: Record<string, string[]>
): string => {
  if (!map) return '';
  const entries = Object.entries(map).filter(([domain]) => domain !== '');
  if (entries.length === 0) return '';
  return entries
    .map(([domain, keywords]) => {
      const keywordText = keywords
        .map((keyword) => extractSheetText(keyword))
        .filter(Boolean)
        .join(', ');

      return keywordText ? `${domain}\n-> ${keywordText}` : domain;
    })
    .join('\n\n');
};

const formatBinaryCodes = (
  codes: string[],
  map: Map<string, BinaryCodeItem>,
  oem: string,
  device: string
): string => {
  if (!codes || codes.length === 0) return '';
  const targetOem = normalizeText(oem);
  const targetDevice = normalizeText(device);

  return codes
    .map((code) => {
      const item = map.get(code);
      if (!item) return '';

      const itemOem = normalizeText(item.attribute1);
      const itemDevice = normalizeText(item.attribute2);
      if (itemOem !== targetOem || itemDevice !== targetDevice) {
        return '';
      }

      return item.comCodeName.trim();
    })
    .filter(Boolean)
    .join('\n');
};

const joinUniqueValues = (values: string[]): string => {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].join(
    '\n'
  );
};

const groupRowRecords = (
  rowRecords: Array<{
    category: string;
    row: Omit<(string | number)[], 0>;
  }>
) => {
  const groupedRows = new Map<
    string,
    {
      category: string;
      oems: string[];
      devices: string[];
      row: Omit<(string | number)[], 0>;
    }
  >();

  rowRecords.forEach((record) => {
    const [oem, device, ...rest] = record.row;
    const key = JSON.stringify(rest);

    const existing = groupedRows.get(key);
    if (existing) {
      existing.oems.push(String(oem ?? ''));
      existing.devices.push(String(device ?? ''));
      return;
    }

    groupedRows.set(key, {
      category: record.category,
      oems: [String(oem ?? '')],
      devices: [String(device ?? '')],
      row: rest,
    });
  });

  const results: Array<{
    category: string;
    row: Omit<(string | number)[], 0>;
  }> = [];

  for (const record of groupedRows.values()) {
    const { category, oems, devices, row } = record;

    // If OEM and DEVICE arrays are the same length, expand them into separate rows
    // preserving their pairing order. This avoids collapsing identical device
    // names across different OEMs into a single deduplicated cell.
    if (oems.length === devices.length) {
      for (let i = 0; i < oems.length; i++) {
        results.push({
          category,
          row: [String(oems[i] ?? ''), String(devices[i] ?? ''), ...row],
        });
      }
    } else {
      // Fallback: join unique values when lengths don't match
      results.push({
        category,
        row: [joinUniqueValues(oems), joinUniqueValues(devices), ...row],
      });
    }
  }

  return results;
};

const resolveSelectedSeqs = (
  selections: PicknowSelection[],
  oemDevices: PicknowOemDevice[],
  settingRows: SettingRow[]
) => {
  const matchedSeqs = new Set<number>();
  const skippedSelections: PicknowSelection[] = [];
  const seqToClients = new Map<number, Set<string>>();

  selections.forEach((selection) => {
    const selectionClient = normalizeText(selection.client);
    const selectionOem = normalizeText(selection.oem);
    const selectionDevice = normalizeText(selection.device);

    // find rows that belong to this exact client + OEM/DEVICE selection
    const clientRows = settingRows.filter((row) => {
      return (
        normalizeText(row.고객사) === selectionClient &&
        normalizeText(row.OEM) === selectionOem &&
        normalizeText(row.DEVICE) === selectionDevice
      );
    });

    const matchedFromClient: PicknowOemDevice[] = [];

    clientRows.forEach((row) => {
      oemDevices.forEach((device) => {
        const rOem = normalizeText(row.OEM);
        const rDevice = normalizeText(row.DEVICE);
        const dOem = normalizeText(device.oem);
        const dDevice = normalizeText(device.device);

        const sameExact = rOem === dOem && rDevice === dDevice;
        const compactSame =
          `${compactText(rOem)}${compactText(rDevice)}` ===
          `${compactText(dOem)}${compactText(dDevice)}`;

        if (sameExact || compactSame) {
          matchedFromClient.push(device);
        }
      });
    });

    if (matchedFromClient.length === 0) {
      // fallback: try global match by OEM/DEVICE name when the exact client row is missing
      const globalMatched = oemDevices.filter((device) =>
        matchesSelection(selection, device)
      );
      if (globalMatched.length === 0) {
        skippedSelections.push(selection);
        return;
      }
      globalMatched.forEach((d) => {
        matchedSeqs.add(d.oemDeviceSeq);
        const existing = seqToClients.get(d.oemDeviceSeq) ?? new Set<string>();
        existing.add(selection.client);
        seqToClients.set(d.oemDeviceSeq, existing);
      });
      return;
    }

    matchedFromClient.forEach((device) => {
      matchedSeqs.add(device.oemDeviceSeq);
      const existing =
        seqToClients.get(device.oemDeviceSeq) ?? new Set<string>();
      existing.add(selection.client);
      seqToClients.set(device.oemDeviceSeq, existing);
    });
  });

  const mapped: Record<number, string[]> = {};
  seqToClients.forEach((set, seq) => {
    mapped[seq] = [...set];
  });

  return {
    matchedSeqs: [...matchedSeqs],
    skippedSelections,
    seqToClients: mapped,
  };
};

export async function syncPicknowConfigurationSheet(
  sheetName: string,
  selections: PicknowSelection[],
  apiInstance: AxiosInstance,
  spreadsheetId: string
): Promise<SyncPicknowConfigurationResult> {
  const targetSheetName = sheetName.trim();

  if (!targetSheetName) {
    throw new Error('시트명이 비어 있습니다.');
  }

  if (selections.length === 0) {
    throw new Error('선택된 OEM/DEVICE가 없습니다.');
  }

  await initializeGoogleAPI();

  const token = await getGoogleToken();
  if (!token) {
    throw new Error(
      'Google 인증 토큰이 없습니다. 로그인 후 다시 시도해주세요.'
    );
  }

  gapi.client.setToken({ access_token: token });

  const sheetId = await preparePicknowConfigurationSheet(
    targetSheetName,
    spreadsheetId
  );

  // fetch Setting sheet to determine device resolution / orientation
  const settingRows: SettingRow[] = await fetchSettingData(spreadsheetId);

  const binaryCodeResponse = await apiInstance.get<BinaryCodeResponse>(
    '/admin/common-code/common-codes/BinaryCode',
    { params: { comCodeGroupCd: 'BinaryCode' } }
  );
  const binaryCodeMap = new Map<string, BinaryCodeItem>(
    extractList(binaryCodeResponse.data.data).map((item) => [
      item.comCodeCd,
      item,
    ])
  );

  const findSettingRow = (oem: string, device: string) => {
    const selOem = normalizeText(oem);
    const selDevice = normalizeText(device);
    const compactSel = `${compactText(selOem)}${compactText(selDevice)}`;
    for (const row of settingRows) {
      const rOem = normalizeText(row.OEM);
      const rDevice = normalizeText(row.DEVICE);
      if (selOem === rOem && selDevice === rDevice) return row;
      const compactRow = `${compactText(rOem)}${compactText(rDevice)}`;
      if (compactRow === compactSel) return row;
    }
    return undefined;
  };

  const sheets = getSheetsClient();

  let supportsOemDevice = true;
  let oemDevices: PicknowOemDevice[] = [];
  try {
    const oemDeviceResponse = await apiInstance.get<PicknowOemDeviceResponse>(
      '/admin/v2/oem-device'
    );
    oemDevices = extractList(oemDeviceResponse.data.data);
  } catch {
    supportsOemDevice = false;
  }

  let matchedSeqs: number[] = [];
  let skippedSelections: PicknowSelection[] = [];
  let seqToClients: Record<number, string[]> = {};

  if (supportsOemDevice) {
    const resolved = resolveSelectedSeqs(selections, oemDevices, settingRows);
    matchedSeqs = resolved.matchedSeqs;
    skippedSelections = resolved.skippedSelections;
    seqToClients = resolved.seqToClients;

    if (matchedSeqs.length === 0) {
      throw new Error(
        '선택한 OEM/DEVICE에 해당하는 데이터를 찾을 수 없습니다.'
      );
    }
  }

  const bookmarkParams = supportsOemDevice
    ? { version: 2, oemDeviceSeqs: matchedSeqs.join(',') }
    : (() => {
        const countryCodes = [
          ...new Set(
            selections.flatMap((sel) => {
              const matched = settingRows.filter(
                (row) =>
                  normalizeText(row.OEM) === normalizeText(sel.oem) &&
                  normalizeText(row.DEVICE) === normalizeText(sel.device)
              );
              return matched
                .map((row) => row.국가코드.trim().toUpperCase())
                .filter(Boolean);
            })
          ),
        ];
        return {
          version: 2,
          recommendedYn: 'Y',
          activeYn: 'Y',
          countryCd: countryCodes[0] ?? '',
          payYnValue: 'Y',
        };
      })();

  const bookmarkList = await fetchAllPagedList<PicknowBookmarkListItem>(
    apiInstance,
    '/admin/v2/bookmark',
    bookmarkParams
  );
  const uniqueBookmarks = Array.from(
    new Map(
      bookmarkList.map((bookmark) => [bookmark.bookmarkSeq, bookmark])
    ).values()
  );

  const detailResults = await executeWithConcurrencyLimit(
    uniqueBookmarks.map((bookmark) => async () => {
      const detailResponse =
        await apiInstance.get<PicknowBookmarkDetailResponse>(
          `/admin/v2/bookmark/${bookmark.bookmarkSeq}`
        );

      return {
        listBookmark: bookmark,
        detail: detailResponse.data.data,
      };
    }),
    { concurrency: 5 }
  );

  const failedBookmarkSeqs = new Set<number>();
  const rowRecords: Array<{
    category: string;
    row: Omit<(string | number)[], 0>;
  }> = [];

  detailResults.forEach((result, resultIndex) => {
    if (result.status === 'rejected') {
      const bookmarkSeq = uniqueBookmarks[resultIndex]?.bookmarkSeq;
      if (bookmarkSeq !== undefined) {
        failedBookmarkSeqs.add(bookmarkSeq);
      }
      return;
    }

    const { listBookmark, detail } = result.value;
    if (!detail) {
      failedBookmarkSeqs.add(listBookmark.bookmarkSeq);
      return;
    }

    const sourceMappings =
      (detail.oemDeviceMappings?.length > 0
        ? detail.oemDeviceMappings
        : listBookmark.oemDevices) ?? [];

    const selectedMappings: PicknowOemDevice[] = supportsOemDevice
      ? sourceMappings.filter((mapping) =>
          matchedSeqs.includes(mapping.oemDeviceSeq)
        )
      : sourceMappings.length > 0
        ? sourceMappings
        : selections.map((sel) => ({
            oemDeviceSeq: 0,
            oem: sel.oem,
            device: sel.device,
          }));

    if (selectedMappings.length === 0) {
      return;
    }

    const configurationYn =
      detail.configurationYn ?? listBookmark.configurationYn;

    if (!isYes(detail.recommendedYn) || !isYes(configurationYn)) {
      return;
    }

    selectedMappings.forEach((mapping) => {
      // find setting rows that match this OEM/DEVICE; prefer settings for the selected client(s)
      const clientsForSeq: string[] =
        seqToClients?.[mapping.oemDeviceSeq] ?? [];

      let matchingSettings = settingRows.filter((row) => {
        const rOem = compactText(normalizeText(row.OEM));
        const rDevice = compactText(normalizeText(row.DEVICE));
        const mOem = compactText(normalizeText(mapping.oem));
        const mDevice = compactText(normalizeText(mapping.device));
        return rOem === mOem && rDevice === mDevice;
      });

      if (clientsForSeq.length > 0) {
        const normalizedClients = clientsForSeq.map((c) => normalizeText(c));
        const clientFiltered = matchingSettings.filter((row) =>
          normalizedClients.includes(normalizeText(row.고객사))
        );
        if (clientFiltered.length > 0) {
          matchingSettings = clientFiltered;
        }
      }

      // determine setting for this OEM/DEVICE (prefer a client-specific match)
      const setting = findSettingRow(mapping.oem, mapping.device);

      const settingCountryCd = setting?.국가코드?.trim();
      if (settingCountryCd) {
        const allowedCountries = settingCountryCd
          .split(',')
          .map((c) => c.trim().toUpperCase())
          .filter(Boolean);
        if (
          allowedCountries.length > 0 &&
          !allowedCountries.includes(detail.countryCd.toUpperCase())
        ) {
          return;
        }
      }

      const { width, height } = parseResolution(setting?.해상도 ?? '');
      const orient = (setting?.Orientation ?? '').toLowerCase();
      const sizeForCheck =
        orient === 'landscape' ? height || width : width || height;

      const resolvedZoom = getValueFromConfig(
        detail.urlConfig?.zoomFactor,
        orient,
        sizeForCheck
      );
      const resolvedUA = getValueFromConfig(
        detail.urlConfig?.userAgent,
        orient,
        sizeForCheck
      );

      rowRecords.push({
        category: detail.categoryCdNm,
        row: [
          mapping.oem,
          mapping.device,
          detail.categoryCdNm,
          detail.title,
          detail.url,
          detail.countryCd,
          detail.defaultYn,
          detail.recommendedYn,
          configurationYn,
          setting?.Orientation ?? '',
          setting?.해상도 ?? '',
          resolvedZoom.heightRange,
          formatZoomFactorForSheet(resolvedZoom.value),
          resolvedUA.value,
          stringifyBooleanArray(detail.urlConfig?.whiteList),
          formatBlackListForSheet(detail.urlConfig?.blackList),
          formatUnSupportedDomainList(detail.urlConfig?.unSupportedDomainList),
          formatBinaryCodes(
            detail.binaryCds ?? [],
            binaryCodeMap,
            mapping.oem,
            mapping.device
          ),
          toBooleanText(detail.urlConfig?.pinchZoom),
          toBooleanText(detail.urlConfig?.supportNewTab),
          toBooleanText(detail.urlConfig?.mouseOnlyPage),
          toBooleanText(detail.urlConfig?.sendStringOnEnter),
          detail.bookmarkSeq,
        ],
      });
    });
  });

  const countryPriority = ['WW', 'KR', 'US', 'IN', 'EU', 'JP'];

  const rows = groupRowRecords(rowRecords)
    .sort((a, b) => {
      // 1) category (ascending, Korean)
      const cat = String(a.category ?? '').localeCompare(
        String(b.category ?? ''),
        'ko'
      );
      if (cat !== 0) return cat;

      // 2) title/name (ascending, Korean). title is at row[3]
      const aTitle = String(a.row?.[3] ?? '');
      const bTitle = String(b.row?.[3] ?? '');
      const nameCmp = aTitle.localeCompare(bTitle, 'ko');
      if (nameCmp !== 0) return nameCmp;

      // 3) country with custom priority
      const aCountry = String(a.row?.[5] ?? '').toUpperCase();
      const bCountry = String(b.row?.[5] ?? '').toUpperCase();
      const aIdx = countryPriority.indexOf(aCountry);
      const bIdx = countryPriority.indexOf(bCountry);

      const aRank = aIdx >= 0 ? aIdx : countryPriority.length + 1;
      const bRank = bIdx >= 0 ? bIdx : countryPriority.length + 1;
      if (aRank !== bRank) return aRank - bRank;

      // fallback: alphabetical by country code
      return aCountry.localeCompare(bCountry, 'en');
    })
    .map((item) => {
      const bookmarkSeq = item.row[item.row.length - 1];
      return [bookmarkSeq, ...item.row.slice(0, -1)];
    });

  if (rows.length === 0) {
    throw new Error(
      '선택한 조건에 해당하는 bookmark 데이터를 찾지 못했습니다.'
    );
  }

  const rowCount = Math.max(rows.length + 2, 3);
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    resource: {
      requests: [
        {
          updateSheetProperties: {
            properties: {
              sheetId,
              gridProperties: {
                rowCount,
              },
            },
            fields: 'gridProperties.rowCount',
          },
        },
      ],
    },
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: buildSheetRange(targetSheetName, 'B3'),
    valueInputOption: 'RAW',
    resource: {
      values: rows,
    },
  });

  return {
    sheetName: targetSheetName,
    selectedCount: selections.length,
    matchedCount: matchedSeqs.length,
    writtenCount: rows.length,
    failedBookmarkSeqs: [...failedBookmarkSeqs],
    skippedSelections,
  };
}
