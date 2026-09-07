import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import ProdTabLayout from '@/feature/pickle-prod/components/ProdTabLayout';
import UsageFilterRadio from '@/feature/pickle-prod/components/UsageFilterRadio';
import LoadingOverlay from '@/shared/components/common/LoadingOverlay';
import Pagination from '@/shared/components/common/Pagination';
import SortControls from '@/shared/components/table/SortControls';
import useListSort from '@/shared/hooks/useListSort';
import { useStagingEnv } from '@/shared/hooks/useStagingEnv';
import { useFastStore } from '@/shared/store/useFastStore';
import { usePickleServerStore } from '@/shared/store/usePickleServerStore';
import type { ProdFastRow } from '@/shared/types/pickleProdContents';
import { loadAllFastRows } from './fastApi';
import ProdFastList from './ProdFastList';

type FastSortKey =
  | 'createdAt'
  | 'fastName'
  | 'dispStartDtime'
  | 'dispEndDtime';

const FAST_SORT_OPTIONS: Array<{ value: FastSortKey; label: string }> = [
  { value: 'createdAt', label: '등록 일시' },
  { value: 'fastName', label: 'FAST 명' },
  { value: 'dispStartDtime', label: '게시 시작일' },
  { value: 'dispEndDtime', label: '게시 종료일' },
];

const FAST_STATUS_FILTER_OPTIONS = [
  '전체',
  '생성 대기',
  '생성중',
  '생성완료',
  '생성취소',
] as const;

type FastStatusFilter = (typeof FAST_STATUS_FILTER_OPTIONS)[number];

const FAST_STATUS_FILTER_TO_CODE: Record<FastStatusFilter, string> = {
  전체: 'ALL',
  '생성 대기': 'QUEUED',
  생성중: 'IN_PROGRESS',
  생성완료: 'COMPLETED',
  생성취소: 'CANCELED',
};

const FastLayout = () => {
  const { isStaging, apiInstance } = useStagingEnv();
  const { isServerLoggedIn } = usePickleServerStore();
  const isPickleLoggedIn = isServerLoggedIn(
    isStaging ? 'pickle-stg' : 'pickle-prod'
  );

  const [allFastData, setAllFastData] = useState<ProdFastRow[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataKeyword, setDataKeyword] = useState('');
  const [dataUsageFilter, setDataUsageFilter] = useState<'All' | 'Y' | 'N'>(
    'All'
  );
  const [dataStatusFilter, setDataStatusFilter] =
    useState<FastStatusFilter>('전체');
  const [dataPage, setDataPage] = useState(1);
  const [dataPageSize, setDataPageSize] = useState(10);
  const [isPageSizeChanging, startPageSizeTransition] = useTransition();
  const dataAbortRef = useRef<AbortController | null>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isPickleLoggedIn) {
      setAllFastData([]);
      return;
    }
    const env = isStaging ? 'stg' : 'prod';
    const { cache, isStale, setCache } = useFastStore.getState();
    if (!isStale(env)) {
      setAllFastData(cache[env]!.data);
      return;
    }
    dataAbortRef.current?.abort();
    const controller = new AbortController();
    dataAbortRef.current = controller;
    setDataLoading(true);
    setAllFastData([]);
    setDataPage(1);
    loadAllFastRows(apiInstance, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setAllFastData(data);
          if (data.length > 0) setCache(env, data);
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          console.error('FAST 목록 조회 실패:', error);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setDataLoading(false);
      });
    return () => controller.abort();
  }, [isStaging, isPickleLoggedIn]);

  const filteredFastData = useMemo(() => {
    const statusCode = FAST_STATUS_FILTER_TO_CODE[dataStatusFilter];
    return allFastData.filter((item) => {
      if (dataUsageFilter !== 'All' && item.usageYn !== dataUsageFilter)
        return false;
      if (statusCode !== 'ALL' && item.hlsStatus !== statusCode) return false;
      if (
        dataKeyword.trim() &&
        !item.fastName.toLowerCase().includes(dataKeyword.toLowerCase())
      )
        return false;
      return true;
    });
  }, [allFastData, dataUsageFilter, dataStatusFilter, dataKeyword]);

  const {
    sortKey: dataSortKey,
    setSortKey: setDataSortKey,
    sortDirection: dataSortDir,
    setSortDirection: setDataSortDir,
    sortedData: sortedFastData,
  } = useListSort<ProdFastRow, FastSortKey>({
    data: filteredFastData,
    sortOptions: FAST_SORT_OPTIONS,
    initialSortKey: 'createdAt',
    initialSortDirection: 'desc',
  });

  useEffect(() => {
    setDataPage(1);
  }, [
    dataUsageFilter,
    dataStatusFilter,
    dataKeyword,
    dataSortKey,
    dataSortDir,
    dataPageSize,
  ]);

  const dataTotalPages =
    dataPageSize === 0 ? 1 : Math.ceil(sortedFastData.length / dataPageSize);
  const displayFastData =
    dataPageSize === 0
      ? sortedFastData
      : sortedFastData.slice(
          (dataPage - 1) * dataPageSize,
          dataPage * dataPageSize
        );

  return (
    <ProdTabLayout
      parentMenu='상용 콘텐츠 관리'
      childMenu='FAST 관리'
      isStaging={isStaging}
      heightClass='h-[90vh]'
    >
      {(activeTab) => (
        <>
          {activeTab === 'data' && (
            <div className='flex-1 p-8 flex flex-col min-h-0'>
              <div className='flex justify-between items-center shrink-0 mb-4'>
                <h3 className='text-point-color font-semibold'>
                  FAST 총{' '}
                  <span className='font-extrabold'>
                    {sortedFastData.length}
                  </span>
                  개
                </h3>
                <SortControls
                  sortKey={dataSortKey}
                  sortOptions={FAST_SORT_OPTIONS}
                  onSortKeyChange={setDataSortKey}
                  sortDirection={dataSortDir}
                  onSortDirectionChange={setDataSortDir}
                />
              </div>
              <div className='flex items-center justify-between mb-4 p-4 bg-gray-50 rounded-xl gap-4'>
                <div className='flex items-center gap-6 flex-wrap'>
                  <UsageFilterRadio
                    name='usageFilter'
                    label='활성화'
                    value={dataUsageFilter}
                    onChange={(v) => setDataUsageFilter(v)}
                  />
                  <UsageFilterRadio
                    name='statusFilter'
                    label='생성 상태'
                    options={FAST_STATUS_FILTER_OPTIONS}
                    value={dataStatusFilter}
                    onChange={(v) => setDataStatusFilter(v)}
                  />
                </div>
                <div className='flex items-center border border-gray-300 rounded-lg bg-white px-3 py-1.5 gap-2 min-w-55'>
                  <input
                    type='text'
                    value={dataKeyword}
                    onChange={(e) => setDataKeyword(e.target.value)}
                    placeholder='FAST 명 검색'
                    className='outline-none text-sm flex-1 text-gray-700 placeholder-gray-400'
                  />
                  <svg
                    xmlns='http://www.w3.org/2000/svg'
                    className='w-4 h-4 text-gray-400 shrink-0'
                    fill='none'
                    viewBox='0 0 24 24'
                    stroke='currentColor'
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      d='M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z'
                    />
                  </svg>
                </div>
              </div>
              <LoadingOverlay loading={dataLoading}>
                FAST 목록을 불러오는 중입니다.
                <br />
                잠시만 기다려주세요!
              </LoadingOverlay>
              {!dataLoading && (
                <div className='relative flex-1 min-h-0'>
                  {isPageSizeChanging && (
                    <div className='absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-white/70'>
                      <div className='flex items-center gap-2 text-sm text-gray-500'>
                        <div className='h-5 w-5 animate-spin rounded-full border-2 border-gray-400 border-t-transparent' />
                        렌더링 중...
                      </div>
                    </div>
                  )}
                  <div
                    ref={tableScrollRef}
                    className='overflow-auto episode-table-scroll h-full pb-1'
                  >
                    <ProdFastList
                      data={displayFastData}
                      isStaging={isStaging}
                    />
                  </div>
                </div>
              )}
              <Pagination
                page={dataPage}
                totalPages={dataTotalPages}
                onChange={setDataPage}
                pageSize={dataPageSize}
                onPageSizeChange={(size) =>
                  startPageSizeTransition(() => setDataPageSize(size))
                }
              />
            </div>
          )}

          {activeTab === 'sync' && (
            <div className='flex-1 p-8 flex items-center justify-center text-gray-400'>
              Excel 동기화는 준비 중입니다.
            </div>
          )}
        </>
      )}
    </ProdTabLayout>
  );
};

export default FastLayout;
