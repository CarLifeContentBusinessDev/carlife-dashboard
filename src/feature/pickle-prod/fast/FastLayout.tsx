import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { toast } from 'react-toastify';
import ProdTabLayout from '@/feature/pickle-prod/components/ProdTabLayout';
import SyncCountHeader from '@/feature/pickle-prod/components/SyncCountHeader';
import { SyncEmptyState } from '@/feature/pickle-prod/components/SyncEmptyState';
import SyncToolbar from '@/feature/pickle-prod/components/SyncToolbar';
import UsageFilterRadio from '@/feature/pickle-prod/components/UsageFilterRadio';
import SheetSelector from '@/feature/pickseries/components/SheetSelector';
import { useSheetSelection } from '@/feature/pickseries/hooks/useSheetSelection';
import {
  SYNC_PAGE_SIZE,
  useSyncState,
} from '@/feature/pickseries/hooks/useSyncState';
import LoadingOverlay from '@/shared/components/common/LoadingOverlay';
import Pagination from '@/shared/components/common/Pagination';
import SortControls from '@/shared/components/table/SortControls';
import useListSort from '@/shared/hooks/useListSort';
import { useStagingEnv } from '@/shared/hooks/useStagingEnv';
import { useFastStore } from '@/shared/store/useFastStore';
import { usePickleServerStore } from '@/shared/store/usePickleServerStore';
import type { ProdFastRow } from '@/shared/types/pickleProdContents';
import { fetchAllFastData } from '@/shared/utils/api/fetchAllFastData';
import { appendNewFastToExcel } from '@/shared/utils/excel/appendNewFast';
import { getNewFastData } from '@/shared/utils/excel/getNewFast';
import { overwriteFastExcelData } from '@/shared/utils/excel/updateFast';
import { updateSheetSyncTime } from '@/shared/utils/excel/updateSheetSyncTime';
import ProdFastList from './ProdFastList';

type FastSortKey = 'createdAt' | 'fastName' | 'dispStartDtime' | 'dispEndDtime';

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
  const { isStaging, apiInstance, spreadsheetId } = useStagingEnv();
  const { isServerLoggedIn } = usePickleServerStore();
  const isPickleLoggedIn = isServerLoggedIn(
    isStaging ? 'pickle-stg' : 'pickle-prod'
  );

  // 데이터 탭
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
  const syncScrollRef = useRef<HTMLDivElement>(null);

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
    fetchAllFastData(apiInstance, controller.signal)
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

  // 동기화 탭
  const [newFasts, setNewFasts] = useState<ProdFastRow[]>([]);
  const [allFasts, setAllFasts] = useState<ProdFastRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [excelLoading, setExcelLoading] = useState(false);
  const [progress, setProgress] = useState('');

  const {
    syncPreviewMode,
    setSyncPreviewMode,
    syncPage,
    syncTotalPages,
    setSyncTotalPages,
    setSyncPage,
    handleSyncPageChange,
  } = useSyncState();

  const defaultSheetName = isStaging ? 'stg_FAST DB' : 'FAST DB';
  const storageKey = isStaging ? 'sheetName:fast:stg' : 'sheetName:fast:prod';
  const { sheetList, selectedSheet, handleSelectSheet } = useSheetSelection({
    isStaging,
    spreadsheetId,
    defaultSheetName,
    storageKey,
  });

  const handleLoadAllFasts = async () => {
    const currentSheet = localStorage.getItem(storageKey) || selectedSheet;
    if (!currentSheet) return toast.warn('시트를 먼저 선택해주세요!');

    try {
      setLoading(true);
      setAllFasts([]);
      setNewFasts([]);
      setSyncPreviewMode(null);
      setSyncPage(1);

      const env = isStaging ? 'stg' : 'prod';
      const { cache, isStale, setCache } = useFastStore.getState();

      let allData: ProdFastRow[];
      if (!isStale(env) && cache[env]?.data.length) {
        allData = cache[env]!.data;
      } else {
        allData = await fetchAllFastData(apiInstance, undefined, setProgress);
        if (allData.length > 0) setCache(env, allData);
      }
      setAllFasts(allData);
      setSyncTotalPages(Math.ceil(allData.length / SYNC_PAGE_SIZE));
      setSyncPreviewMode('all');
      toast.info(
        `${allData.length}개의 전체 데이터를 조회했습니다. 확인 후 동기화를 실행해주세요.`
      );
    } catch (error) {
      console.error('전체 FAST 조회 실패:', error);
    } finally {
      setLoading(false);
      setProgress('');
    }
  };

  const handleSearchNew = async () => {
    const currentSheet = localStorage.getItem(storageKey) || selectedSheet;
    if (!currentSheet) return toast.warn('시트를 먼저 선택해주세요!');

    try {
      setLoading(true);
      setNewFasts([]);
      setAllFasts([]);
      setSyncPreviewMode(null);
      setSyncPage(1);

      const newList = await getNewFastData(
        setProgress,
        apiInstance,
        spreadsheetId,
        currentSheet
      );
      setNewFasts(newList);
      setSyncTotalPages(Math.ceil(newList.length / SYNC_PAGE_SIZE));
      setSyncPreviewMode('new');

      if (newList.length === 0) {
        toast.info('추가할 신규 FAST가 없습니다.');
      } else {
        toast.info(
          `${newList.length}개의 신규 데이터를 조회했습니다. 확인 후 동기화를 실행해주세요.`
        );
      }
    } catch (error) {
      console.error('신규 FAST 탐지 실패:', error);
    } finally {
      setLoading(false);
      setProgress('');
    }
  };

  const handleSyncExcel = async () => {
    const currentSheet = localStorage.getItem(storageKey) || selectedSheet;
    if (!currentSheet) return toast.warn('시트를 먼저 선택해주세요!');
    if (!syncPreviewMode)
      return toast.warn('먼저 신규 또는 전체 조회를 실행해주세요!');

    const previewData = syncPreviewMode === 'new' ? newFasts : allFasts;

    if (syncPreviewMode === 'new' && previewData.length === 0) {
      return toast.info('동기화할 신규 데이터가 없습니다.');
    }

    const confirmMessage =
      syncPreviewMode === 'new'
        ? `${currentSheet} 시트에 신규 ${previewData.length}건을 추가합니다. 계속하시겠습니까?`
        : `${currentSheet} 시트의 기존 데이터를 삭제하고 ${previewData.length}건으로 전체 재적재합니다. 계속하시겠습니까?`;

    if (!window.confirm(confirmMessage)) return;

    try {
      setExcelLoading(true);

      if (syncPreviewMode === 'new') {
        await appendNewFastToExcel(
          previewData,
          setProgress,
          setExcelLoading,
          currentSheet,
          spreadsheetId
        );
      } else {
        await overwriteFastExcelData(previewData, currentSheet, spreadsheetId);
      }

      await updateSheetSyncTime(defaultSheetName, spreadsheetId);
    } catch (error) {
      console.error('Excel 동기화 실패:', error);
    } finally {
      setExcelLoading(false);
      setProgress('');
    }
  };

  const selectedSheetGid = sheetList.find(
    (sheet) => sheet.name === selectedSheet
  )?.id;
  const excelHref = selectedSheetGid
    ? `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit?gid=${selectedSheetGid}#gid=${selectedSheetGid}`
    : `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

  const syncDisplayData = syncPreviewMode === 'new' ? newFasts : allFasts;

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
            <div className='flex-1 p-8 flex flex-col min-h-0'>
              <SyncToolbar
                onSearchNew={handleSearchNew}
                onLoadAll={handleLoadAllFasts}
                excelHref={excelHref}
                onSync={handleSyncExcel}
                loading={loading}
                excelLoading={excelLoading}
                progress={progress}
                syncPreviewMode={syncPreviewMode}
              />
              <div className='flex justify-between items-center shrink-0'>
                <SyncCountHeader
                  syncPreviewMode={syncPreviewMode}
                  newCount={newFasts.length}
                  allCount={allFasts.length}
                />
                <div className='flex gap-8 items-center'>
                  <SheetSelector
                    sheetList={sheetList}
                    selectedSheet={selectedSheet}
                    isStaging={isStaging}
                    onChange={handleSelectSheet}
                  />
                </div>
              </div>
              <div className='w-full flex-1 flex flex-col mt-4 min-h-0'>
                <LoadingOverlay progress={progress} loading={loading}>
                  FAST 목록을 불러오는 중입니다.
                  <br />
                  잠시만 기다려주세요!
                </LoadingOverlay>
                {!loading && syncPreviewMode && (
                  <>
                    <div
                      ref={syncScrollRef}
                      className='overflow-x-scroll episode-table-scroll pb-1 flex-1'
                    >
                      <ProdFastList
                        data={syncDisplayData.slice(
                          (syncPage - 1) * SYNC_PAGE_SIZE,
                          syncPage * SYNC_PAGE_SIZE
                        )}
                        isStaging={isStaging}
                      />
                    </div>
                    <Pagination
                      page={syncPage}
                      totalPages={syncTotalPages}
                      onChange={handleSyncPageChange}
                    />
                  </>
                )}
                <SyncEmptyState
                  loading={loading}
                  syncPreviewMode={!!syncPreviewMode}
                />
              </div>
            </div>
          )}
        </>
      )}
    </ProdTabLayout>
  );
};

export default FastLayout;
