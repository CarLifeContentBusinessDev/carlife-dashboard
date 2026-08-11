import {
  batchUpdateSpreadsheet,
  updateSheetValues,
} from '@/feature/picknow/utils/picknowSheetApi';
import {
  extractList,
  fetchAllPagedList,
} from '@/shared/utils/api/fetchAllPagedList';
import { executeWithConcurrencyLimit } from '@/shared/utils/api/requestPool';
import { buildSheetRange } from '@/shared/utils/excel/sheetRange';
import {
  fetchSettingData,
  type SettingRow,
} from '@/shared/utils/googleSheets/fetchSettingData';
import {
  compactText,
  groupRowRecords,
  normalizeText,
  resolveSelectedSeqs,
} from '@/shared/utils/googleSheets/oemDeviceMatching';
import { preparePicknowConfigurationSheet } from '@/shared/utils/googleSheets/preparePicknowConfigurationSheet';
import {
  formatBinaryCodes,
  formatBlackListForSheet,
  formatUnSupportedDomainList,
  formatZoomFactorForSheet,
  stringifyBooleanArray,
  toBooleanText,
} from '@/shared/utils/googleSheets/sheetTextFormatters';
import type {
  BinaryCodeItem,
  BinaryCodeResponse,
  PicknowBookmarkDetailResponse,
  PicknowBookmarkListItem,
  PicknowOemDevice,
  PicknowOemDeviceResponse,
  PicknowSelection,
  PicknowUrlConfigVersion,
  SyncPicknowConfigurationResult,
} from '@/shared/utils/googleSheets/syncPicknowConfigurationSheet.types';
import type { AxiosInstance } from 'axios';

const isYes = (value: unknown): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    return value.trim().toLowerCase() === 'y';
  }
  return false;
};

const resolveUrlConfigVersion = (
  urlConfig: Record<string, PicknowUrlConfigVersion> | undefined,
  version: string | undefined
): { config: PicknowUrlConfigVersion | undefined; resolvedVersion: string } => {
  if (!urlConfig) return { config: undefined, resolvedVersion: 'default' };

  const trimmedVersion = (version ?? '').trim();
  if (trimmedVersion && trimmedVersion.toLowerCase() !== 'default') {
    const versioned = urlConfig[trimmedVersion];
    if (versioned && typeof versioned === 'object') {
      return { config: versioned, resolvedVersion: trimmedVersion };
    }
  }

  if (urlConfig.default && typeof urlConfig.default === 'object') {
    return { config: urlConfig.default, resolvedVersion: 'default' };
  }
  return {
    config: urlConfig as unknown as PicknowUrlConfigVersion,
    resolvedVersion: 'default',
  };
};

const parseResolution = (res: string) => {
  if (!res) return { width: 0, height: 0 };
  const m = res.match(/(\d+)\D+(\d+)/);
  if (!m) return { width: 0, height: 0 };
  return { width: parseInt(m[1], 10) || 0, height: parseInt(m[2], 10) || 0 };
};

const getValueFromConfig = (
  config: unknown,
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

  const defaultValue = (parsedConfig as Record<string, unknown>).default;
  if (defaultValue !== undefined && defaultValue !== null) {
    return { value: String(defaultValue), heightRange: 'default' };
  }

  return { value: '', heightRange: '' };
};

export async function syncPicknowConfigurationSheet(
  customerName: string,
  selections: PicknowSelection[],
  apiInstance: AxiosInstance,
  spreadsheetId: string,
  serverLabel: string
): Promise<SyncPicknowConfigurationResult> {
  const targetCustomerName = customerName.trim();

  if (!targetCustomerName) {
    throw new Error('고객사명이 비어 있습니다.');
  }

  if (selections.length === 0) {
    throw new Error('선택된 OEM/DEVICE가 없습니다.');
  }

  const settingRows: SettingRow[] = await fetchSettingData(
    spreadsheetId,
    serverLabel
  );

  const normalizedCustomerName = normalizeText(targetCustomerName);
  const matchedSettingRow = settingRows.find(
    (row) => normalizeText(row.고객사) === normalizedCustomerName
  );
  const rawSheetName = (matchedSettingRow?.시트명 || targetCustomerName).trim();
  const serverPrefix = matchedSettingRow?.서버?.trim();
  const targetSheetName = serverPrefix
    ? `[${serverPrefix}] ${rawSheetName}`
    : rawSheetName;

  if (!targetSheetName) {
    throw new Error('시트명이 비어 있습니다.');
  }

  const sheetId = await preparePicknowConfigurationSheet(
    targetSheetName,
    spreadsheetId
  );

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

      const setting =
        matchingSettings[0] ?? findSettingRow(mapping.oem, mapping.device);

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

      const { config: urlConfigVersion, resolvedVersion } =
        resolveUrlConfigVersion(detail.urlConfig, setting?.Version);

      const resolvedZoom = getValueFromConfig(
        urlConfigVersion?.zoomFactor,
        orient,
        sizeForCheck
      );
      const resolvedUA = getValueFromConfig(
        urlConfigVersion?.userAgent,
        orient,
        sizeForCheck
      );

      rowRecords.push({
        category: detail.categoryCdNm,
        row: [
          mapping.oem,
          mapping.device,
          resolvedVersion,
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
          stringifyBooleanArray(urlConfigVersion?.whiteList),
          formatBlackListForSheet(urlConfigVersion?.blackList),
          formatUnSupportedDomainList(urlConfigVersion?.unSupportedDomainList),
          formatBinaryCodes(
            detail.binaryCds ?? [],
            binaryCodeMap,
            mapping.oem,
            mapping.device
          ),
          toBooleanText(urlConfigVersion?.pinchZoom),
          toBooleanText(urlConfigVersion?.supportNewTab),
          toBooleanText(urlConfigVersion?.mouseOnlyPage),
          toBooleanText(urlConfigVersion?.sendStringOnEnter),
          detail.bookmarkSeq,
        ],
      });
    });
  });

  const countryPriority = ['WW', 'KR', 'US', 'IN', 'EU', 'JP'];

  const rows = groupRowRecords(rowRecords)
    .sort((a, b) => {
      const cat = String(a.category ?? '').localeCompare(
        String(b.category ?? ''),
        'ko'
      );
      if (cat !== 0) return cat;

      const aTitle = String(a.row?.[4] ?? '');
      const bTitle = String(b.row?.[4] ?? '');
      const nameCmp = aTitle.localeCompare(bTitle, 'ko');
      if (nameCmp !== 0) return nameCmp;

      const aCountry = String(a.row?.[6] ?? '').toUpperCase();
      const bCountry = String(b.row?.[6] ?? '').toUpperCase();
      const aIdx = countryPriority.indexOf(aCountry);
      const bIdx = countryPriority.indexOf(bCountry);

      const aRank = aIdx >= 0 ? aIdx : countryPriority.length + 1;
      const bRank = bIdx >= 0 ? bIdx : countryPriority.length + 1;
      if (aRank !== bRank) return aRank - bRank;

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

  await batchUpdateSpreadsheet(spreadsheetId, [
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
    { clearBasicFilter: { sheetId } },
    {
      setBasicFilter: {
        filter: {
          range: {
            sheetId,
            startRowIndex: 1,
            endRowIndex: rowCount,
            startColumnIndex: 1,
            endColumnIndex: 25,
          },
        },
      },
    },
  ]);

  await updateSheetValues(
    spreadsheetId,
    buildSheetRange(targetSheetName, 'B3'),
    rows,
    'RAW'
  );

  return {
    sheetName: targetSheetName,
    selectedCount: selections.length,
    matchedCount: matchedSeqs.length,
    writtenCount: rows.length,
    failedBookmarkSeqs: [...failedBookmarkSeqs],
    skippedSelections,
  };
}
