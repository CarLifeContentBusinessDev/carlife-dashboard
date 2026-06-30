import { useCallback, useEffect, useRef, useState } from 'react';

export interface ProdPaginationFetcherArgs {
  page: number;
  filter: 'All' | 'Y' | 'N';
  keyword: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  signal: AbortSignal;
}

interface UseProdPaginationOptions<T> {
  fetcher: (
    args: ProdPaginationFetcherArgs
  ) => Promise<{ dataList: T[]; totalCount: number }>;
  deps: React.DependencyList;
  pageSize?: number;
  enabled?: boolean;
  autoFetch?: boolean;
  initialSortBy?: string;
  initialSortOrder?: 'asc' | 'desc';
}

export function useProdPagination<T>({
  fetcher,
  deps,
  pageSize = 10,
  enabled = true,
  autoFetch = true,
  initialSortBy = 'createdAt',
  initialSortOrder = 'desc',
}: UseProdPaginationOptions<T>) {
  const [prodData, setProdData] = useState<T[]>([]);
  const [prodLoading, setProdLoading] = useState(false);
  const [prodPage, setProdPage] = useState(1);
  const [prodTotalPages, setProdTotalPages] = useState(0);
  const [prodTotalCount, setProdTotalCount] = useState(0);
  const [prodSearchQuery, setProdSearchQuery] = useState('');
  const [usageFilter, setUsageFilter] = useState<'All' | 'Y' | 'N'>('All');
  const [sortBy, setSortBy] = useState(initialSortBy);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(initialSortOrder);

  const abortControllerRef = useRef<AbortController | null>(null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const usageFilterRef = useRef(usageFilter);
  usageFilterRef.current = usageFilter;
  const prodSearchQueryRef = useRef(prodSearchQuery);
  prodSearchQueryRef.current = prodSearchQuery;
  const sortByRef = useRef(sortBy);
  sortByRef.current = sortBy;
  const sortOrderRef = useRef(sortOrder);
  sortOrderRef.current = sortOrder;

  const cancelOngoingWork = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  useEffect(() => () => cancelOngoingWork(), [cancelOngoingWork]);

  const fetchPage = useCallback(
    async (
      page: number,
      filter: 'All' | 'Y' | 'N',
      keyword: string,
      sortBy: string,
      sortOrder: 'asc' | 'desc'
    ) => {
      cancelOngoingWork();
      const controller = new AbortController();
      abortControllerRef.current = controller;
      setProdLoading(true);
      try {
        const result = await fetcherRef.current({
          page,
          filter,
          keyword,
          sortBy,
          sortOrder,
          signal: controller.signal,
        });
        if (!controller.signal.aborted) {
          setProdData(result.dataList);
          setProdTotalCount(result.totalCount);
          setProdTotalPages(Math.ceil(result.totalCount / pageSize));
        }
      } catch (e) {
        if (!controller.signal.aborted) {
          console.error(e);
          setProdData([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setProdLoading(false);
        }
      }
    },
    [cancelOngoingWork, pageSize]
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!enabled) return;
    if (!autoFetch) return;
    setProdPage(1);
    setProdData([]);
    fetchPage(
      1,
      usageFilterRef.current,
      prodSearchQueryRef.current,
      sortByRef.current,
      sortOrderRef.current
    );
    return cancelOngoingWork;
    // deps + enabled + autoFetch
  }, [...deps, enabled, autoFetch]);

  const isSearchFirstRender = useRef(true);
  useEffect(() => {
    if (isSearchFirstRender.current) {
      isSearchFirstRender.current = false;
      return () => {
        isSearchFirstRender.current = true;
      };
    }
    const timer = setTimeout(() => {
      setProdPage(1);
      fetchPage(
        1,
        usageFilterRef.current,
        prodSearchQuery,
        sortByRef.current,
        sortOrderRef.current
      );
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prodSearchQuery]);

  const handleProdPageChange = useCallback(
    (page: number) => {
      setProdPage(page);
      fetchPage(
        page,
        usageFilterRef.current,
        prodSearchQueryRef.current,
        sortByRef.current,
        sortOrderRef.current
      );
    },
    [fetchPage]
  );

  const handleSearch = useCallback(() => {
    setProdPage(1);
    fetchPage(
      1,
      usageFilterRef.current,
      prodSearchQueryRef.current,
      sortByRef.current,
      sortOrderRef.current
    );
  }, [fetchPage]);

  const handleUsageFilterChange = useCallback(
    (value: 'All' | 'Y' | 'N') => {
      setUsageFilter(value);
      setProdPage(1);
      fetchPage(
        1,
        value,
        prodSearchQueryRef.current,
        sortByRef.current,
        sortOrderRef.current
      );
    },
    [fetchPage]
  );

  const handleSortKeyChange = useCallback(
    (newSortBy: string) => {
      setSortBy(newSortBy);
      setProdPage(1);
      fetchPage(
        1,
        usageFilterRef.current,
        prodSearchQueryRef.current,
        newSortBy,
        sortOrderRef.current
      );
    },
    [fetchPage]
  );

  const handleSortOrderChange = useCallback(
    (newSortOrder: 'asc' | 'desc') => {
      setSortOrder(newSortOrder);
      setProdPage(1);
      fetchPage(
        1,
        usageFilterRef.current,
        prodSearchQueryRef.current,
        sortByRef.current,
        newSortOrder
      );
    },
    [fetchPage]
  );

  return {
    prodData,
    prodLoading,
    prodPage,
    prodTotalPages,
    prodTotalCount,
    prodSearchQuery,
    setProdSearchQuery,
    usageFilter,
    sortBy,
    sortOrder,
    fetchPage,
    handleProdPageChange,
    handleSearch,
    handleUsageFilterChange,
    handleSortKeyChange,
    handleSortOrderChange,
    cancelOngoingWork,
  };
}
