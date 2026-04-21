import { useCallback, useEffect, useRef, useState } from 'react';

export interface ProdPaginationFetcherArgs {
  page: number;
  filter: 'All' | 'Y' | 'N';
  keyword: string;
  signal: AbortSignal;
}

interface UseProdPaginationOptions<T> {
  fetcher: (
    args: ProdPaginationFetcherArgs
  ) => Promise<{ dataList: T[]; totalCount: number }>;
  deps: React.DependencyList;
  pageSize?: number;
  enabled?: boolean;
}

export function useProdPagination<T>({
  fetcher,
  deps,
  pageSize = 10,
  enabled = true,
}: UseProdPaginationOptions<T>) {
  const [prodData, setProdData] = useState<T[]>([]);
  const [prodLoading, setProdLoading] = useState(false);
  const [prodPage, setProdPage] = useState(1);
  const [prodTotalPages, setProdTotalPages] = useState(0);
  const [prodTotalCount, setProdTotalCount] = useState(0);
  const [prodSearchQuery, setProdSearchQuery] = useState('');
  const [usageFilter, setUsageFilter] = useState<'All' | 'Y' | 'N'>('All');

  const abortControllerRef = useRef<AbortController | null>(null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const usageFilterRef = useRef(usageFilter);
  usageFilterRef.current = usageFilter;
  const prodSearchQueryRef = useRef(prodSearchQuery);
  prodSearchQueryRef.current = prodSearchQuery;

  const cancelOngoingWork = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  useEffect(() => () => cancelOngoingWork(), [cancelOngoingWork]);

  const fetchPage = useCallback(
    async (page: number, filter: 'All' | 'Y' | 'N', keyword: string) => {
      cancelOngoingWork();
      const controller = new AbortController();
      abortControllerRef.current = controller;
      setProdLoading(true);
      try {
        const result = await fetcherRef.current({
          page,
          filter,
          keyword,
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
    setProdPage(1);
    fetchPage(1, usageFilterRef.current, prodSearchQueryRef.current);
    return cancelOngoingWork;
  }, deps);

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
      fetchPage(1, usageFilterRef.current, prodSearchQuery);
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prodSearchQuery]);

  const handleProdPageChange = useCallback(
    (page: number) => {
      setProdPage(page);
      fetchPage(page, usageFilterRef.current, prodSearchQueryRef.current);
    },
    [fetchPage]
  );

  const handleSearch = useCallback(() => {
    setProdPage(1);
    fetchPage(1, usageFilterRef.current, prodSearchQueryRef.current);
  }, [fetchPage]);

  const handleUsageFilterChange = useCallback(
    (value: 'All' | 'Y' | 'N') => {
      setUsageFilter(value);
      setProdPage(1);
      fetchPage(1, value, prodSearchQueryRef.current);
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
    fetchPage,
    handleProdPageChange,
    handleSearch,
    handleUsageFilterChange,
    cancelOngoingWork,
  };
}
