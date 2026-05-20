import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { toast } from 'react-toastify';
import LoadingOverlay from '@/components/common/LoadingOverlay.tsx';
import Pagination from '@/components/common/Pagination.tsx';
import PickleLoginBanner from '@/components/common/PickleLoginBanner.tsx';
import TabHeader from '@/components/common/TabHeader.tsx';
import SheetSelector from '@/components/filter/SheetSelector.tsx';
import UsageFilterRadio from '@/components/filter/UsageFilterRadio.tsx';
import SyncCountHeader from '@/components/sync/SyncCountHeader.tsx';
import { SyncEmptyState } from '@/components/sync/SyncEmptyState.tsx';
import SyncToolbar from '@/components/sync/SyncToolbar.tsx';
import SortControls from '@/components/table/SortControls';
import useListSort from '@/hook/useListSort';
import { useSheetSelection } from '@/hook/useSheetSelection.ts';
import { useStagingEnv } from '@/hook/useStagingEnv.ts';
import { SYNC_PAGE_SIZE, useSyncState } from '@/hook/useSyncState.ts';
import { useLoginTokenStore } from '@/store/useLoginTokenStore.ts';
import { useChannelStore } from '@/store/useChannelStore.ts';
import { usePickleServerStore } from '@/store/usePickleServerStore.ts';
import type { usingChannelProps } from '@/types/pickleProdContents.ts';
import { fetchAllData } from '@/utils/api/fetchAllData.ts';
import { appendNewDataToTop } from '@/utils/excel/appendNewDataToExcel.ts';
import { getNewData } from '@/utils/excel/getNewData.ts';
import { overwriteExcelData } from '@/utils/excel/updateExcel.ts';
import { updateSheetSyncTime } from '@/utils/excel/updateSheetSyncTime.ts';
import ProdChannelList from './ProdChannelList.tsx';

const CATEGORY = 'channel';

type ChannelSortKey =
  | 'createdAt'
  | 'channelName'
  | 'dispDtime'
  | 'likeCnt'
  | 'listenCnt';

const CHANNEL_SORT_OPTIONS: Array<{ value: ChannelSortKey; label: string }> = [
  { value: 'createdAt', label: '등록일' },
  { value: 'channelName', label: '채널명' },
  { value: 'dispDtime', label: '최근 업로드일' },
  { value: 'likeCnt', label: '좋아요수' },
  { value: 'listenCnt', label: '재생 요청 수' },
];

const sortChannels = (channels: usingChannelProps[]) =>
  [...channels].sort((a, b) => {
    const catA = (a.categoryName ?? '').toLowerCase();
    const catB = (b.categoryName ?? '').toLowerCase();
    const catCompare = catA.localeCompare(catB, undefined, {
      sensitivity: 'base',
    });
    if (catCompare !== 0) return catCompare;

    const nameA = (a.channelName ?? '').toLowerCase();
    const nameB = (b.channelName ?? '').toLowerCase();
    return nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
  });

const ChannelLayout = () => {
  const { isStaging, apiInstance, spreadsheetId } = useStagingEnv();
  const { loginToken } = useLoginTokenStore();
  const { getServerToken, isServerLoggedIn } = usePickleServerStore();
  const accessToken = getServerToken(isStaging ? 'stg' : 'prod') ?? '';
  const isPickleLoggedIn = isServerLoggedIn(isStaging ? 'stg' : 'prod');
  const [activeTab, setActiveTab] = useState<'data' | 'sync'>('data');

  // ── 데이터 탭 ──────────────────────────────────────────────────────────────
  const [allChannelData, setAllChannelData] = useState<usingChannelProps[]>([]);
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
  const syncScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isPickleLoggedIn) {
      setAllChannelData([]);
      return;
    }
    const env = isStaging ? 'stg' : 'prod';
    const { cache, isStale, setCache } = useChannelStore.getState();
    if (!isStale(env)) {
      setAllChannelData(cache[env]!.data);
      return;
    }
    dataAbortRef.current?.abort();
    const controller = new AbortController();
    dataAbortRef.current = controller;
    setDataLoading(true);
    setAllChannelData([]);
    setDataPage(1);
    fetchAllData('channel', setDataProgress, controller.signal, apiInstance)
      .then((data) => {
        if (!controller.signal.aborted) {
          setAllChannelData(data);
          if (data.length > 0) setCache(env, data);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setDataLoading(false);
          setDataProgress('');
        }
      });
    return () => controller.abort();
  }, [isStaging, isPickleLoggedIn, apiInstance]);

  const filteredChannelData = useMemo(() => {
    return allChannelData.filter((item) => {
      if (dataUsageFilter !== 'All' && item.usageYn !== dataUsageFilter)
        return false;
      if (
        dataKeyword.trim() &&
        !item.channelName.toLowerCase().includes(dataKeyword.toLowerCase())
      )
        return false;
      return true;
    });
  }, [allChannelData, dataUsageFilter, dataKeyword]);

  const {
    sortKey: dataSortKey,
    setSortKey: setDataSortKey,
    sortDirection: dataSortDir,
    setSortDirection: setDataSortDir,
    sortedData: sortedChannelData,
  } = useListSort<usingChannelProps, ChannelSortKey>({
    data: filteredChannelData,
    sortOptions: CHANNEL_SORT_OPTIONS,
    initialSortKey: 'createdAt',
    initialSortDirection: 'desc',
  });

  useEffect(() => {
    setDataPage(1);
  }, [dataUsageFilter, dataKeyword, dataSortKey, dataSortDir, dataPageSize]);

  const dataTotalPages =
    dataPageSize === 0 ? 1 : Math.ceil(sortedChannelData.length / dataPageSize);
  const displayChannelData =
    dataPageSize === 0
      ? sortedChannelData
      : sortedChannelData.slice(
          (dataPage - 1) * dataPageSize,
          dataPage * dataPageSize
        );

  // ── 동기화 탭 ─────────────────────────────────────────────────────────────
  const [newChannels, setNewChannels] = useState<usingChannelProps[] | null>(
    null
  );
  const [addData, setAddData] = useState<usingChannelProps[]>([]);
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

  const defaultSheetName = isStaging ? 'stg_채널 DB' : '채널 DB';
  const storageKey = isStaging
    ? 'sheetName:channel:stg'
    : 'sheetName:channel:prod';
  const { sheetList, selectedSheet, handleSelectSheet } = useSheetSelection({
    isStaging,
    loginToken,
    spreadsheetId,
    defaultSheetName,
    storageKey,
  });

  const handleLoadAllChannels = async () => {
    if (!loginToken) return toast.warn('로그인을 먼저 해주세요!');
    const currentSheet = localStorage.getItem(storageKey) || selectedSheet;
    if (!currentSheet) return toast.warn('시트를 먼저 선택해주세요!');

    setNewChannels(null);
    setAddData([]);
    setSyncPreviewMode(null);

    try {
      setLoading(true);
      const allData = await fetchAllData(
        CATEGORY,
        setProgress,
        undefined,
        apiInstance
      );
      const sortedAllData = sortChannels(allData);
      setAddData(sortedAllData);
      setSyncTotalPages(Math.ceil(sortedAllData.length / SYNC_PAGE_SIZE));
      setSyncPage(1);
      setSyncPreviewMode('all');
      toast.info(
        `${sortedAllData.length}개의 전체 데이터를 조회했습니다. 확인 후 동기화를 실행해주세요.`
      );
    } catch (error) {
      console.error('전체 채널·도서 조회 실패:', error);
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
      setNewChannels(null);
      setAddData([]);
      setSyncPreviewMode(null);
      setSyncPage(1);

      const newList = await getNewData(
        loginToken,
        accessToken,
        setProgress,
        CATEGORY,
        apiInstance,
        spreadsheetId
      );
      const sortedNewList = sortChannels(newList);
      setNewChannels(sortedNewList);
      setSyncTotalPages(Math.ceil(sortedNewList.length / SYNC_PAGE_SIZE));
      setSyncPreviewMode('new');

      if (sortedNewList.length === 0) {
        toast.info('추가할 신규 채널·도서가 없습니다.');
      } else {
        toast.info(
          `${sortedNewList.length}개의 신규 데이터를 조회했습니다. 확인 후 동기화를 실행해주세요.`
        );
      }
    } catch (error) {
      console.error('신규 채널·도서 탐지 실패:', error);
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

    const previewData =
      syncPreviewMode === 'new' ? (newChannels ?? []) : addData;

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
        await appendNewDataToTop(
          previewData,
          setProgress,
          CATEGORY,
          setExcelLoading,
          currentSheet,
          true,
          spreadsheetId
        );
      } else {
        await overwriteExcelData(
          previewData,
          loginToken,
          CATEGORY,
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
    ? `https://docs.google.com/spreadsheets/d/${import.meta.env.VITE_STG_SPREADSHEET_ID}/edit?gid=902383353#gid=902383353`
    : `https://docs.google.com/spreadsheets/d/${import.meta.env.VITE_SPREADSHEET_ID}/edit?gid=934666118#gid=934666118`;

  const syncDisplayData =
    syncPreviewMode === 'new' ? (newChannels ?? []) : addData;

  return (
    <div className='flex flex-col h-[90vh]'>
      <PickleLoginBanner
        serverId={isStaging ? 'stg' : 'prod'}
        serverLabel={isStaging ? 'STG' : '상용'}
      />
      <div className='p-10 flex flex-col h-full'>
        <h1 className='text-3xl font-bold mb-4 indent-1'>
          채널·도서 관리{isStaging ? ' (스테이징)' : ''}
        </h1>
        <div className='w-full rounded-2xl bg-white mt-4 flex flex-col'>
          <TabHeader activeTab={activeTab} onChange={setActiveTab} />

          {activeTab === 'data' && (
            <div className='flex-1 p-8 flex flex-col min-h-0'>
              <div className='flex justify-between items-center flex-shrink-0 mb-4'>
                <h3 className='text-point-color font-semibold'>
                  채널·도서 총{' '}
                  <span className='font-extrabold'>
                    {sortedChannelData.length}
                  </span>
                  개
                </h3>
                <SortControls
                  sortKey={dataSortKey}
                  sortOptions={CHANNEL_SORT_OPTIONS}
                  onSortKeyChange={setDataSortKey}
                  sortDirection={dataSortDir}
                  onSortDirectionChange={setDataSortDir}
                />
              </div>
              <div className='flex items-center justify-between mb-4 p-4 bg-gray-50 rounded-xl gap-4'>
                <div className='flex items-center gap-6 flex-wrap'>
                  <UsageFilterRadio
                    name='channelUsageFilter'
                    value={dataUsageFilter}
                    onChange={(v) => setDataUsageFilter(v)}
                  />
                </div>
                <div className='flex items-center border border-gray-300 rounded-lg bg-white px-3 py-1.5 gap-2 min-w-[220px]'>
                  <input
                    type='text'
                    value={dataKeyword}
                    onChange={(e) => setDataKeyword(e.target.value)}
                    placeholder='채널명 검색'
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
                채널 목록을 불러오는 중입니다.
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
                    <ProdChannelList
                      data={displayChannelData}
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
                onLoadAll={handleLoadAllChannels}
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
                  newCount={newChannels?.length ?? 0}
                  allCount={addData.length}
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
                  새로운 채널·도서 목록을 불러오는 중입니다.
                  <br />
                  잠시만 기다려주세요!
                </LoadingOverlay>
                {!loading && syncPreviewMode && (
                  <>
                    <div
                      ref={syncScrollRef}
                      className='overflow-x-scroll episode-table-scroll pb-1 flex-1'
                    >
                      <ProdChannelList
                        data={syncDisplayData.slice(
                          (syncPage - 1) * SYNC_PAGE_SIZE,
                          syncPage * SYNC_PAGE_SIZE
                        )}
                        scrollRef={syncScrollRef}
                        episodeCountByChannelId={{}}
                        latestEpisodeUploadByChannelId={{}}
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

export default ChannelLayout;
