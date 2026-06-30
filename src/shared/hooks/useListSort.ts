import { useMemo, useState } from 'react';

export type SortDirection = 'asc' | 'desc';

export interface SortOption<K extends string> {
  value: K;
  label: string;
}

interface UseListSortOptions<T, K extends keyof T & string> {
  data: T[];
  sortOptions: SortOption<K>[];
  initialSortKey?: K;
  initialSortDirection?: SortDirection;
  emptyLastOnAscKeys?: K[];
}

const isEmptyValue = (value: unknown) => {
  if (value == null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (typeof value === 'number') return Number.isNaN(value);
  return false;
};

const toComparableValue = (value: unknown) => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    const asNumber = Number(trimmed);
    if (trimmed !== '' && Number.isFinite(asNumber)) return asNumber;
    return trimmed.toLowerCase();
  }

  return value;
};

export default function useListSort<
  T extends object,
  K extends keyof T & string,
>({
  data,
  sortOptions,
  initialSortKey,
  initialSortDirection = 'asc',
  emptyLastOnAscKeys = [],
}: UseListSortOptions<T, K>) {
  const defaultSortKey = initialSortKey ?? sortOptions[0]?.value;

  const [sortKey, setSortKey] = useState<K>(
    (defaultSortKey as K) ?? ('id' as K)
  );
  const [sortDirection, setSortDirection] =
    useState<SortDirection>(initialSortDirection);

  const sortedData = useMemo(() => {
    if (data.length === 0) return data;

    const collator = new Intl.Collator('ko');
    const emptyLast =
      sortDirection === 'asc' && emptyLastOnAscKeys.includes(sortKey);

    // Schwartzian transform: key를 O(n)번만 추출해 O(n log n) 중복 계산 방지
    const keyed = data.map((item) => ({
      item,
      key: toComparableValue((item as any)[sortKey]),
      empty: emptyLast && isEmptyValue((item as any)[sortKey]),
    }));

    keyed.sort((a, b) => {
      if (emptyLast) {
        if (a.empty && !b.empty) return 1;
        if (!a.empty && b.empty) return -1;
      }

      const left = a.key;
      const right = b.key;

      if (typeof left === 'number' && typeof right === 'number') {
        return sortDirection === 'asc' ? left - right : right - left;
      }

      const leftText = String(left ?? '');
      const rightText = String(right ?? '');
      const compared = collator.compare(leftText, rightText);

      return sortDirection === 'asc' ? compared : -compared;
    });

    return keyed.map((x) => x.item);
  }, [data, sortKey, sortDirection, emptyLastOnAscKeys]);

  return {
    sortKey,
    setSortKey,
    sortDirection,
    setSortDirection,
    sortedData,
  };
}
