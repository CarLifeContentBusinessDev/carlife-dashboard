import { normalizeText } from '@/shared/utils/googleSheets/oemDeviceMatching';
import type { BinaryCodeItem } from '@/shared/utils/googleSheets/syncPicknowConfigurationSheet.types';

const toText = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'Y' : 'N';
  if (Array.isArray(value)) return value.join('\n');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

export const toBooleanText = (value: unknown): string => {
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

export const formatZoomFactorForSheet = (value: string): string => {
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

export const stringifyBooleanArray = (
  values?: unknown[] | string | null
): string => {
  if (!values) return '';
  if (Array.isArray(values)) {
    return values.map(extractSheetText).filter(Boolean).join('\n');
  }

  return extractSheetText(values);
};

export const formatBlackListForSheet = (values?: unknown): string => {
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

export const formatUnSupportedDomainList = (
  map?: Record<string, string[]>
): string => {
  if (!map) return '';
  const entries = Object.entries(map).filter(([domain]) => domain !== '');
  if (entries.length === 0) return '';
  return entries
    .map(([domain, keywords]) => {
      const keywordText = Array.isArray(keywords)
        ? keywords
            .map((keyword) => extractSheetText(keyword))
            .filter(Boolean)
            .join(', ')
        : '';

      return keywordText ? `${domain}\n-> ${keywordText}` : domain;
    })
    .join('\n\n');
};

export const formatBinaryCodes = (
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
