import LoadingOverlay from '@/components/common/LoadingOverlay';
import Pagination from '@/components/common/Pagination';
import PickleLoginBanner from '@/components/common/PickleLoginBanner';
import TabHeader from '@/components/common/TabHeader';
import SheetSelector from '@/components/filter/SheetSelector';
import UsageFilterRadio from '@/components/filter/UsageFilterRadio';
import SyncCountHeader from '@/components/sync/SyncCountHeader';
import { SyncEmptyState } from '@/components/sync/SyncEmptyState';
import SyncToolbar from '@/components/sync/SyncToolbar';
import SortControls from '@/components/table/SortControls';
import useListSort from '@/hook/useListSort';
import { useSheetSelection } from '@/hook/useSheetSelection';
import { useStagingEnv } from '@/hook/useStagingEnv';
import { SYNC_PAGE_SIZE, useSyncState } from '@/hook/useSyncState';
import { useCurationStore } from '@/store/useCurationStore';
import { useLoginTokenStore } from '@/store/useLoginTokenStore';
import { usePickleServerStore } from '@/store/usePickleServerStore';
import type {
  curationListItemProps,
  ProdCurationRow,
} from '@/types/pickleProdContents';
import { fetchAllCurationData } from '@/utils/api/fetchAllData';
import { appendNewCurationToExcel } from '@/utils/excel/appendNewCurationToExcel';
import { getNewCurationData } from '@/utils/excel/getNewCuration';
import { overwriteCurationExcelData } from '@/utils/excel/updateCuration';
import { updateSheetSyncTime } from '@/utils/excel/updateSheetSyncTime';
import { mapCurationStatus } from '@/utils/format/statusMapper';
import type { AxiosInstance } from 'axios';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { toast } from 'react-toastify';
import ProdCurationList from './ProdCurationList';

type ExhibitionFilter =
  | 'All'
  | '게시 중'
  | '게시 대기'
  | '게시 종료'
  | '게시 예약';

const EXHIBITION_OPTIONS = [
  'All',
  '게시 중',
  '게시 대기',
  '게시 종료',
  '게시 예약',
] as const;

type CurationSortKey =
  | 'curationCreatedAt'
  | 'curationName'
  | 'dispStartDtime'
  | 'dispEndDtime';

const CURATION_SORT_OPTIONS: Array<{ value: CurationSortKey; label: string }> =
  [
    { value: 'curationCreatedAt', label: '등록일' },
    { value: 'curationName', label: '큐레이션명' },
    { value: 'dispStartDtime', label: '게시 시작일' },
    { value: 'dispEndDtime', label: '게시 종료일' },
  ];

const mapCurationListToRow = (
  listItem: curationListItemProps
): ProdCurationRow => ({
  curationId: listItem.curationId,
  thumbnailTitle: '',
  thumbnailUrlSquare: listItem.thumbnailUrlSquare ?? '',
  thumbnailUrlRect: listItem.thumbnailUrlRect ?? '',
  curationType: listItem.curationType,
  curationName: listItem.curationName,
  curationDesc: listItem.curationDesc,
  activeState: listItem.usageYn ?? '',
  exhibitionState: mapCurationStatus(listItem.status ?? ''),
  field: '',
  section: 0,
  dispStartDtime: listItem.dispStartDtime,
  dispEndDtime: listItem.dispEndDtime,
  curationCreatedAt: listItem.createdAt,
  channelId: 0,
  episodeId: 0,
  usageYn: '',
  channelName: '',
  episodeName: '',
  dispDtime: '',
  createdAt: '',
  playTime: 0,
  likeCnt: 0,
  listenCnt: 0,
  uploader: listItem.creatorName ?? '',
});

async function loadAllCurationList(
  apiInstance: AxiosInstance,
  signal?: AbortSignal
): Promise<ProdCurationRow[]> {
  const firstRes = await apiInstance.get(
    '/admin/curation?page=1&size=100&periodType=ALL',
    { signal }
  );
  const { dataList, pageInfo } = firstRes.data.data as {
    dataList: curationListItemProps[];
    pageInfo: { totalCount: number };
  };
  const totalPages = Math.ceil(pageInfo.totalCount / 100);
  let all: curationListItemProps[] = [...dataList];
  for (let page = 2; page <= totalPages; page++) {
    if (signal?.aborted) return [];
    const res = await apiInstance.get(
      `/admin/curation?page=${page}&size=100&periodType=ALL`,
      { signal }
    );
    all = all.concat(
      (
        res.data.data as {
          dataList: curationListItemProps[];
        }
      ).dataList
    );
  }
  return all.map(mapCurationListToRow);
}

const CurationLayout = () => {
  const { isStaging, apiInstance, spreadsheetId } = useStagingEnv();
  const { loginToken } = useLoginTokenStore();
  const { isServerLoggedIn } = usePickleServerStore();
  const isPickleLoggedIn = isServerLoggedIn(isStaging ? 'stg' : 'prod');
  const [activeTab, setActiveTab] = useState<'data' | 'sync'>('data');

  // ── 데이터 탭 ──────────────────────────────────────────────────────────────
  const [allCurationData, setAllCurationData] = useState<ProdCurationRow[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataKeyword, setDataKeyword] = useState('');
  const [dataUsageFilter, setDataUsageFilter] = useState<'All' | 'Y' | 'N'>(
    'All'
  );
  const [dataExhibitionFilter, setDataExhibitionFilter] =
    useState<ExhibitionFilter>('All');
  const [dataPage, setDataPage] = useState(1);
  const [dataPageSize, setDataPageSize] = useState(10);
  const [isPageSizeChanging, startPageSizeTransition] = useTransition();
  const dataAbortRef = useRef<AbortController | null>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const syncScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isPickleLoggedIn) {
      setAllCurationData([]);
      return;
    }
    const env = isStaging ? 'stg' : 'prod';
    const { cache, isStale, setCache } = useCurationStore.getState();
    if (!isStale(env)) {
      setAllCurationData(cache[env]!.data);
      return;
    }
    dataAbortRef.current?.abort();
    const controller = new AbortController();
    dataAbortRef.current = controller;
    setDataLoading(true);
    setAllCurationData([]);
    setDataPage(1);
    loadAllCurationList(apiInstance, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setAllCurationData(data);
          if (data.length > 0) setCache(env, data);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setDataLoading(false);
      });
    return () => controller.abort();
  }, [isStaging, isPickleLoggedIn]);

  const filteredCurationData = useMemo(() => {
    return allCurationData.filter((item) => {
      if (dataUsageFilter !== 'All' && item.activeState !== dataUsageFilter)
        return false;
      if (
        dataExhibitionFilter !== 'All' &&
        item.exhibitionState !== dataExhibitionFilter
      )
        return false;
      if (
        dataKeyword.trim() &&
        !item.curationName.toLowerCase().includes(dataKeyword.toLowerCase())
      )
        return false;
      return true;
    });
  }, [allCurationData, dataUsageFilter, dataExhibitionFilter, dataKeyword]);

  const {
    sortKey: dataSortKey,
    setSortKey: setDataSortKey,
    sortDirection: dataSortDir,
    setSortDirection: setDataSortDir,
    sortedData: sortedCurationData,
  } = useListSort<ProdCurationRow, CurationSortKey>({
    data: filteredCurationData,
    sortOptions: CURATION_SORT_OPTIONS,
    initialSortKey: 'curationCreatedAt',
    initialSortDirection: 'desc',
  });

  useEffect(() => {
    setDataPage(1);
  }, [
    dataUsageFilter,
    dataExhibitionFilter,
    dataKeyword,
    dataSortKey,
    dataSortDir,
    dataPageSize,
  ]);

  const dataTotalPages =
    dataPageSize === 0
      ? 1
      : Math.ceil(sortedCurationData.length / dataPageSize);
  const displayCurationData =
    dataPageSize === 0
      ? sortedCurationData
      : sortedCurationData.slice(
          (dataPage - 1) * dataPageSize,
          dataPage * dataPageSize
        );

  // ── 동기화 탭 ─────────────────────────────────────────────────────────────
  const [newCurations, setNewCurations] = useState<ProdCurationRow[]>([]);
  const [allCurations, setAllCurations] = useState<ProdCurationRow[]>([]);
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

  const defaultSheetName = isStaging ? 'stg_큐레이션 DB' : '큐레이션 DB';
  const storageKey = isStaging
    ? 'sheetName:curation:stg'
    : 'sheetName:curation:prod';
  const { sheetList, selectedSheet, handleSelectSheet } = useSheetSelection({
    isStaging,
    loginToken,
    spreadsheetId,
    defaultSheetName,
    storageKey,
  });

  const handleLoadAllCurations = async () => {
    if (!loginToken) return toast.warn('로그인을 먼저 해주세요!');
    const currentSheet = localStorage.getItem(storageKey) || selectedSheet;
    if (!currentSheet) return toast.warn('시트를 먼저 선택해주세요!');

    try {
      setLoading(true);
      setAllCurations([]);
      setNewCurations([]);
      setSyncPreviewMode(null);
      setSyncPage(1);

      const allData = await fetchAllCurationData(apiInstance);
      setAllCurations(allData as ProdCurationRow[]);
      setSyncTotalPages(Math.ceil(allData.length / SYNC_PAGE_SIZE));
      setSyncPreviewMode('all');
      toast.info(
        `${allData.length}개의 전체 데이터를 조회했습니다. 확인 후 동기화를 실행해주세요.`
      );
    } catch (error) {
      console.error('전체 큐레이션 조회 실패:', error);
    } finally {
      setLoading(false);
      setProgress('');
    }
  };

  const handleSearchNew = async () => {
    if (!loginToken) return toast.warn('로그인을 먼저 해주세요!');
    const currentSheet = localStorage.getItem(storageKey) || selectedSheet;
    if (!currentSheet) return toast.warn('시트를 먼저 선택해주세요!');

    try {
      setLoading(true);
      setNewCurations([]);
      setAllCurations([]);
      setSyncPreviewMode(null);
      setSyncPage(1);

      const newList = await getNewCurationData(
        loginToken,
        setProgress,
        apiInstance,
        spreadsheetId,
        currentSheet
      );
      setNewCurations(newList as ProdCurationRow[]);
      setSyncTotalPages(Math.ceil(newList.length / SYNC_PAGE_SIZE));
      setSyncPreviewMode('new');

      if (newList.length === 0) {
        toast.info('추가할 신규 큐레이션이 없습니다.');
      } else {
        toast.info(
          `${newList.length}개의 신규 데이터를 조회했습니다. 확인 후 동기화를 실행해주세요.`
        );
      }
    } catch (error) {
      console.error('신규 큐레이션 탐지 실패:', error);
    } finally {
      setLoading(false);
      setProgress('');
    }
  };

  const handleSyncExcel = async () => {
    if (!loginToken) return toast.warn('로그인을 먼저 해주세요!');
    const currentSheet = localStorage.getItem(storageKey) || selectedSheet;
    if (!currentSheet) return toast.warn('시트를 먼저 선택해주세요!');
    if (!syncPreviewMode)
      return toast.warn('먼저 신규 또는 전체 조회를 실행해주세요!');

    const previewData = syncPreviewMode === 'new' ? newCurations : allCurations;

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
        await appendNewCurationToExcel(
          previewData,
          setProgress,
          setExcelLoading,
          currentSheet,
          spreadsheetId
        );
      } else {
        await overwriteCurationExcelData(
          previewData,
          loginToken,
          currentSheet,
          spreadsheetId
        );
      }

      await updateSheetSyncTime(defaultSheetName, spreadsheetId);
    } catch (error) {
      console.error('Excel 동기화 실패:', error);
    } finally {
      setExcelLoading(false);
      setProgress('');
    }
  };

  const excelHref = isStaging
    ? `https://docs.google.com/spreadsheets/d/${import.meta.env.VITE_STG_SPREADSHEET_ID}/edit?gid=1243772316#gid=1243772316`
    : `https://docs.google.com/spreadsheets/d/${import.meta.env.VITE_SPREADSHEET_ID}/edit?gid=991347809#gid=991347809`;

  const syncDisplayData =
    syncPreviewMode === 'new' ? newCurations : allCurations;

  return (
    <div className='flex flex-col h-[90vh]'>
      <PickleLoginBanner
        serverId={isStaging ? 'stg' : 'prod'}
        serverLabel={isStaging ? 'STG' : '상용'}
      />
      <div className='p-10 flex flex-col h-full'>
        <h1 className='text-3xl font-bold mb-4 indent-1'>
          큐레이션 관리{isStaging ? ' (스테이징)' : ''}
        </h1>
        <div className='w-full rounded-2xl bg-white mt-4 flex flex-col'>
          <TabHeader activeTab={activeTab} onChange={setActiveTab} />

          {activeTab === 'data' && (
            <div className='flex-1 p-8 flex flex-col min-h-0'>
              <div className='flex justify-between items-center flex-shrink-0 mb-4'>
                <h3 className='text-point-color font-semibold'>
                  큐레이션 총{' '}
                  <span className='font-extrabold'>
                    {sortedCurationData.length}
                  </span>
                  개
                </h3>
                <SortControls
                  sortKey={dataSortKey}
                  sortOptions={CURATION_SORT_OPTIONS}
                  onSortKeyChange={setDataSortKey}
                  sortDirection={dataSortDir}
                  onSortDirectionChange={setDataSortDir}
                />
              </div>
              <div className='flex items-center justify-between mb-4 p-4 bg-gray-50 rounded-xl gap-4'>
                <div className='flex items-center gap-6 flex-wrap'>
                  <UsageFilterRadio
                    name='usageFilter'
                    value={dataUsageFilter}
                    onChange={(v) => setDataUsageFilter(v)}
                  />
                  <UsageFilterRadio
                    name='exhibitionFilter'
                    label='전시 상태'
                    options={EXHIBITION_OPTIONS}
                    value={dataExhibitionFilter}
                    onChange={(v) =>
                      setDataExhibitionFilter(v as ExhibitionFilter)
                    }
                  />
                </div>
                <div className='flex items-center border border-gray-300 rounded-lg bg-white px-3 py-1.5 gap-2 min-w-[220px]'>
                  <input
                    type='text'
                    value={dataKeyword}
                    onChange={(e) => setDataKeyword(e.target.value)}
                    placeholder='큐레이션명 검색'
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
                큐레이션 목록을 불러오는 중입니다.
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
                    <ProdCurationList
                      data={displayCurationData}
                      scrollRef={tableScrollRef}
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
                onLoadAll={handleLoadAllCurations}
                excelHref={excelHref}
                onSync={handleSyncExcel}
                loading={loading}
                excelLoading={excelLoading}
                progress={progress}
                syncPreviewMode={syncPreviewMode}
              />
              <div className='flex justify-between items-center flex-shrink-0'>
                <SyncCountHeader
                  syncPreviewMode={syncPreviewMode}
                  newCount={newCurations.length}
                  allCount={allCurations.length}
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
                  큐레이션 목록을 불러오는 중입니다.
                  <br />
                  잠시만 기다려주세요!
                </LoadingOverlay>
                {!loading && syncPreviewMode && (
                  <>
                    <div
                      ref={syncScrollRef}
                      className='overflow-x-scroll episode-table-scroll pb-1 flex-1'
                    >
                      <ProdCurationList
                        data={syncDisplayData.slice(
                          (syncPage - 1) * SYNC_PAGE_SIZE,
                          syncPage * SYNC_PAGE_SIZE
                        )}
                        scrollRef={syncScrollRef}
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
        </div>
      </div>
    </div>
  );
};

export default CurationLayout;
