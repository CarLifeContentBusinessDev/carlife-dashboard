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
import { useEpisodeStore } from '@/store/useEpisodeStore';
import { useLoginTokenStore } from '@/store/useLoginTokenStore';
import { usePickleServerStore } from '@/store/usePickleServerStore';
import type { usingDataProps } from '@/types/pickleProdContents';
import { fetchAllData } from '@/utils/api/fetchAllData';
import { appendNewDataToTop } from '@/utils/excel/appendNewDataToExcel';
import { getNewDataWithExcel } from '@/utils/excel/getNewData';
import { clearExcelRange, overwriteExcelData } from '@/utils/excel/updateExcel';
import { findChangedData } from '@/utils/excel/updateLogs';
import { updateSheetSyncTime } from '@/utils/excel/updateSheetSyncTime';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { toast } from 'react-toastify';
import EpisodeList from './EpisodeList';
import ProdEpisodeList from './ProdEpisodeList';
import {
  enrichEpisodesWithAudioDuration,
  warmAudioDurationCache,
} from '@/utils/audio/fetchAudioDuration';

const CATEGORY = 'episode';

type EpisodeSortKey =
  | 'createdAt'
  | 'channelName'
  | 'episodeName'
  | 'dispDtime'
  | 'likeCnt'
  | 'listenCnt';

const EPISODE_SORT_OPTIONS: Array<{ value: EpisodeSortKey; label: string }> = [
  { value: 'createdAt', label: '등록일' },
  { value: 'channelName', label: '채널명' },
  { value: 'episodeName', label: '에피소드명' },
  { value: 'dispDtime', label: '게시일자' },
  { value: 'likeCnt', label: '좋아요수' },
  { value: 'listenCnt', label: '청취수' },
];

const EpisodeLayout = () => {
  const { isStaging, apiInstance, spreadsheetId } = useStagingEnv();
  const { loginToken } = useLoginTokenStore();
  const { isServerLoggedIn } = usePickleServerStore();
  const isPickleLoggedIn = isServerLoggedIn(isStaging ? 'stg' : 'prod');
  const [activeTab, setActiveTab] = useState<'data' | 'sync'>('data');

  // ── 데이터 탭 ──────────────────────────────────────────────────────────────
  const [allEpiData, setAllEpiData] = useState<usingDataProps[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataProgress, setDataProgress] = useState('');
  const [dataKeyword, setDataKeyword] = useState('');
  const [dataUsageFilter, setDataUsageFilter] = useState<'All' | 'Y' | 'N'>(
    'All'
  );
  const [dataPage, setDataPage] = useState(1);
  const [dataPageSize, setDataPageSize] = useState(10);
  const [isPageSizeChanging, startPageSizeTransition] = useTransition();
  const dataAbortRef = useRef<AbortController | null>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isPickleLoggedIn) {
      setAllEpiData([]);
      return;
    }
    const env = isStaging ? 'stg' : 'prod';
    const { cache, isStale, setCache } = useEpisodeStore.getState();
    if (!isStale(env)) {
      setAllEpiData(cache[env]!.data);
      return;
    }
    dataAbortRef.current?.abort();
    const controller = new AbortController();
    dataAbortRef.current = controller;
    setDataLoading(true);
    setAllEpiData([]);
    setDataPage(1);
    fetchAllData('episode', setDataProgress, controller.signal, apiInstance)
      .then((data) => {
        if (!controller.signal.aborted) {
          setAllEpiData(data);
          if (data.length > 0) setCache(env, data);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setDataProgress('');
          setDataLoading(false);
        }
      });
    return () => controller.abort();
  }, [isStaging, isPickleLoggedIn]);

  const filteredEpiData = useMemo(() => {
    return allEpiData.filter((item) => {
      if (dataUsageFilter !== 'All' && item.usageYn !== dataUsageFilter)
        return false;
      if (
        dataKeyword.trim() &&
        !item.episodeName.toLowerCase().includes(dataKeyword.toLowerCase())
      )
        return false;
      return true;
    });
  }, [allEpiData, dataUsageFilter, dataKeyword]);

  const {
    sortKey: dataSortKey,
    setSortKey: setDataSortKey,
    sortDirection: dataSortDir,
    setSortDirection: setDataSortDir,
    sortedData: sortedEpiData,
  } = useListSort<usingDataProps, EpisodeSortKey>({
    data: filteredEpiData,
    sortOptions: EPISODE_SORT_OPTIONS,
    initialSortKey: 'createdAt',
    initialSortDirection: 'desc',
  });

  useEffect(() => {
    setDataPage(1);
  }, [dataUsageFilter, dataKeyword, dataSortKey, dataSortDir, dataPageSize]);

  const dataTotalPages =
    dataPageSize === 0 ? 1 : Math.ceil(sortedEpiData.length / dataPageSize);
  const displayEpiData =
    dataPageSize === 0
      ? sortedEpiData
      : sortedEpiData.slice(
          (dataPage - 1) * dataPageSize,
          dataPage * dataPageSize
        );

  // ── 동기화 탭 ─────────────────────────────────────────────────────────────
  const [newEpi, setNewEpi] = useState<usingDataProps[]>([]);
  const [duplicateNewEpi, setDuplicateNewEpi] = useState<usingDataProps[]>([]);
  const [allEpisodes, setAllEpisodes] = useState<usingDataProps[]>([]);
  const [duplicateAllEpisodes, setDuplicateAllEpisodes] = useState<
    usingDataProps[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [excelLoading, setExcelLoading] = useState(false);
  const [progress, setProgress] = useState('');

  const {
    syncPreviewMode,
    setSyncPreviewMode,
    syncPage,
    syncTotalPages,
    setSyncTotalPages,
    handleSyncPageChange,
  } = useSyncState();

  const defaultSheetName = isStaging ? 'stg_에피소드 DB' : '에피소드 DB';
  const storageKey = isStaging
    ? 'sheetName:episode:stg'
    : 'sheetName:episode:prod';
  const { sheetList, selectedSheet, handleSelectSheet } = useSheetSelection({
    isStaging,
    loginToken,
    spreadsheetId,
    defaultSheetName,
    storageKey,
  });

  const getSheetName = (name: string) => (isStaging ? `stg_${name}` : name);

  const handleSearchNew = async () => {
    setLoading(true);
    try {
      const currentSheet = localStorage.getItem(storageKey) || selectedSheet;
      const newList = await getNewDataWithExcel(
        setProgress,
        apiInstance,
        spreadsheetId,
        currentSheet
      );
      setProgress('');
      setNewEpi(newList);
      setDuplicateNewEpi([]);
      setSyncPreviewMode('new');
      setSyncTotalPages(Math.ceil(newList.length / SYNC_PAGE_SIZE));
    } finally {
      setLoading(false);
    }
  };

  const handleLoadAllEpisodes = async () => {
    setLoading(true);
    try {
      const allList = await fetchAllData(
        CATEGORY,
        setProgress,
        undefined,
        apiInstance
      );
      const duplicateData = await findChangedData(allList);
      setProgress('');
      setAllEpisodes(allList);
      setDuplicateAllEpisodes(duplicateData);
      setSyncPreviewMode('all');
      setSyncTotalPages(Math.ceil(allList.length / SYNC_PAGE_SIZE));
    } finally {
      setLoading(false);
    }
  };

  const handleSyncExcel = async () => {
    if (!loginToken) return toast.warn('로그인을 먼저 해주세요!');
    if (!syncPreviewMode)
      return toast.warn('신규/전체 조회를 먼저 실행해주세요!');
    const currentSheet = localStorage.getItem(storageKey) || selectedSheet;
    if (!currentSheet) return toast.warn('시트를 먼저 선택해주세요!');

    const dataToSync = syncPreviewMode === 'new' ? newEpi : allEpisodes;

    if (syncPreviewMode === 'all') {
      const confirmMessage = `${currentSheet} 시트의 기존 데이터를 삭제하고 ${dataToSync.length}건으로 전체 재적재합니다. 계속하시겠습니까?`;
      if (!window.confirm(confirmMessage)) return;
    }

    try {
      setExcelLoading(true);

      const enrichedDataToSync = enrichEpisodesWithAudioDuration(dataToSync);

      const duplicateToSync =
        syncPreviewMode === 'new' ? duplicateNewEpi : duplicateAllEpisodes;
      const shouldAppendLogs =
        syncPreviewMode === 'new' && duplicateToSync.length > 0;

      if (syncPreviewMode === 'new') {
        await appendNewDataToTop(
          enrichedDataToSync,
          setProgress,
          CATEGORY,
          setExcelLoading,
          currentSheet,
          false,
          spreadsheetId
        );
      } else {
        await overwriteExcelData(
          enrichedDataToSync,
          loginToken,
          CATEGORY,
          currentSheet,
          spreadsheetId,
          4,
          setProgress
        );
        const logsSheetName = getSheetName('Episode_Logs');
        await clearExcelRange('B4:M300000', logsSheetName, spreadsheetId);
      }

      if (shouldAppendLogs) {
        const enrichedDuplicateToSync =
          enrichEpisodesWithAudioDuration(duplicateToSync);
        const logsSheet = getSheetName('Episode_Logs');
        setProgress(
          `Episode_Logs 시트에 변경된 데이터 ${duplicateToSync.length}개 추가 중...`
        );
        await appendNewDataToTop(
          enrichedDuplicateToSync,
          setProgress,
          CATEGORY,
          setExcelLoading,
          logsSheet,
          false,
          spreadsheetId
        );
      }

      await updateSheetSyncTime(defaultSheetName, spreadsheetId);
      const syncedLogCount = shouldAppendLogs ? duplicateToSync.length : 0;
      toast.success(
        `에피소드 ${dataToSync.length}개, 변경된 에피소드 ${syncedLogCount}개 \n 동기화에 성공했습니다!`
      );
    } catch (error) {
      console.error('Excel 동기화 실패:', error);
    } finally {
      setExcelLoading(false);
      setProgress('');
    }
  };

  const excelHref = isStaging
    ? `https://docs.google.com/spreadsheets/d/${import.meta.env.VITE_STG_SPREADSHEET_ID}/edit?gid=418216794#gid=418216794`
    : `https://docs.google.com/spreadsheets/d/${import.meta.env.VITE_SPREADSHEET_ID}/edit?gid=1925187377#gid=1925187377`;

  return (
    <div className='flex flex-col h-full'>
      <PickleLoginBanner
        serverId={isStaging ? 'stg' : 'prod'}
        serverLabel={isStaging ? 'STG' : '상용'}
      />
      <div className='p-10 flex flex-col h-full'>
        <h1 className='text-3xl font-bold mb-4 indent-1'>
          에피소드 관리{isStaging ? ' (스테이징)' : ''}
        </h1>
        <div className='w-full rounded-2xl bg-white mt-4 flex flex-col'>
          <TabHeader activeTab={activeTab} onChange={setActiveTab} />

          {activeTab === 'data' && (
            <div className='flex-1 p-8 flex flex-col min-h-0'>
              <div className='flex justify-between items-center flex-shrink-0 mb-4'>
                <h3 className='text-point-color font-semibold'>
                  에피소드 총{' '}
                  <span className='font-extrabold'>{sortedEpiData.length}</span>
                  개
                </h3>
                <SortControls
                  sortKey={dataSortKey}
                  sortOptions={EPISODE_SORT_OPTIONS}
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
                </div>
                <div className='flex items-center border border-gray-300 rounded-lg bg-white px-3 py-1.5 gap-2 min-w-[220px]'>
                  <input
                    type='text'
                    value={dataKeyword}
                    onChange={(e) => setDataKeyword(e.target.value)}
                    placeholder='에피소드명 검색'
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
              <LoadingOverlay loading={dataLoading} progress={dataProgress}>
                에피소드 목록을 불러오는 중입니다.
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
                    <ProdEpisodeList
                      data={displayEpiData}
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
                onLoadAll={handleLoadAllEpisodes}
                excelHref={excelHref}
                onSync={handleSyncExcel}
                loading={loading}
                excelLoading={excelLoading}
                progress={progress}
                syncPreviewMode={syncPreviewMode}
              />
              <div className='flex justify-between items-center flex-shrink-0 mb-4'>
                <SyncCountHeader
                  syncPreviewMode={syncPreviewMode}
                  newCount={newEpi.length}
                  allCount={allEpisodes.length}
                />
                <div className='flex gap-8 items-center'>
                  <SheetSelector
                    sheetList={sheetList}
                    selectedSheet={selectedSheet}
                    isStaging={isStaging}
                    disabled={excelLoading || loading}
                    onChange={handleSelectSheet}
                  />
                </div>
              </div>
              <div className='w-full flex-1 flex flex-col mt-4 min-h-0'>
                <LoadingOverlay progress={progress} loading={loading}>
                  에피소드 목록을 불러오는 중입니다.
                  <br />
                  잠시만 기다려주세요!
                </LoadingOverlay>
                {!loading && syncPreviewMode && (
                  <>
                    <div className='overflow-x-scroll episode-table-scroll pb-1 flex-1'>
                      <EpisodeList
                        data={(syncPreviewMode === 'new'
                          ? newEpi
                          : allEpisodes
                        ).slice(
                          (syncPage - 1) * SYNC_PAGE_SIZE,
                          syncPage * SYNC_PAGE_SIZE
                        )}
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

export default EpisodeLayout;
