import { useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import LoadingOverlay from '../../../../components/common/LoadingOverlay.tsx';
import Pagination from '../../../../components/common/Pagination.tsx';
import SheetSelector from '../../../../components/filter/SheetSelector.tsx';
import SyncCountHeader from '../../../../components/sync/SyncCountHeader.tsx';
import SyncToolbar from '../../../../components/sync/SyncToolbar.tsx';
import TabHeader from '../../../../components/common/TabHeader.tsx';
import UsageFilterRadio from '../../../../components/filter/UsageFilterRadio.tsx';
import { useProdPagination } from '../../../../hook/useProdPagination.ts';
import { useSheetSelection } from '../../../../hook/useSheetSelection.ts';
import { useStagingEnv } from '../../../../hook/useStagingEnv.ts';
import { useSyncState, SYNC_PAGE_SIZE } from '../../../../hook/useSyncState.ts';
import { useAccessTokenStore } from '../../../../store/useAccessTokenStore.ts';
import { useLoginTokenStore } from '../../../../store/useLoginTokenStore.ts';
import type { usingChannelProps } from '../../../../types/type.ts';
import { appendNewDataToTop } from '../../../../utils/excel/appendNewDataToExcel.ts';
import { fetchAllData } from '../../../../utils/api/fetchAllData.ts';
import { getNewData } from '../../../../utils/excel/getNewData.ts';
import { updateSheetSyncTime } from '../../../../utils/excel/updateSheetSyncTime.ts';
import { overwriteExcelData } from '../../../../utils/excel/updateExcel.ts';
import ProdChannelList from './ProdChannelList.tsx';
import { SyncEmptyState } from '../../../../components/sync/SyncEmptyState.tsx';

const CATEGORY = 'channel';
const PAGE_SIZE = 10;

const sortChannelsByCreatedAtDesc = (channels: usingChannelProps[]) =>
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
  const { accessToken } = useAccessTokenStore();
  const [activeTab, setActiveTab] = useState<'data' | 'sync'>('data');

  const [episodeCountByChannelId, setEpisodeCountByChannelId] = useState<
    Record<number, number>
  >({});
  const [latestEpisodeUploadByChannelId, setLatestEpisodeUploadByChannelId] =
    useState<Record<number, string>>({});

  // 동기화 탭
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

  const episodeCountLoadingRef = useRef<Set<number>>(new Set());

  const fetchEpisodeCounts = async (channels: usingChannelProps[]) => {
    if (!loginToken || channels.length === 0) return;

    const targetIds = channels
      .map((channel) => channel.channelId)
      .filter(
        (channelId) =>
          (episodeCountByChannelId[channelId] === undefined ||
            latestEpisodeUploadByChannelId[channelId] === undefined) &&
          !episodeCountLoadingRef.current.has(channelId)
      );

    if (targetIds.length === 0) return;

    targetIds.forEach((channelId) =>
      episodeCountLoadingRef.current.add(channelId)
    );

    await Promise.all(
      targetIds.map(async (channelId) => {
        try {
          const res = await apiInstance.get(
            `/admin/episode?page=1&size=1&channelId=${channelId}&withPlaylists=Y`
          );
          const totalCount = Number(res.data?.data?.pageInfo?.totalCount ?? 0);
          const latestDispDtime = String(
            res.data?.data?.dataList?.[0]?.dispDtime ?? ''
          );
          setEpisodeCountByChannelId((prev) => ({
            ...prev,
            [channelId]: totalCount,
          }));
          setLatestEpisodeUploadByChannelId((prev) => ({
            ...prev,
            [channelId]: latestDispDtime,
          }));
        } catch (error) {
          console.error(`채널 ${channelId}의 에피소드 수 조회 실패:`, error);
          setEpisodeCountByChannelId((prev) => ({ ...prev, [channelId]: 0 }));
          setLatestEpisodeUploadByChannelId((prev) => ({
            ...prev,
            [channelId]: '',
          }));
        } finally {
          episodeCountLoadingRef.current.delete(channelId);
        }
      })
    );
  };

  const {
    prodData,
    prodLoading,
    prodPage,
    prodTotalPages,
    prodTotalCount,
    prodSearchQuery,
    setProdSearchQuery,
    usageFilter,
    handleProdPageChange,
    handleSearch,
    handleUsageFilterChange,
    cancelOngoingWork,
  } = useProdPagination<usingChannelProps>({
    fetcher: async ({ page, filter, keyword, signal }) => {
      const params = new URLSearchParams({
        page: String(page),
        size: String(PAGE_SIZE),
      });
      if (filter !== 'All') params.set('usageYn', filter);
      if (keyword.trim()) params.set('keyword', keyword.trim());
      const res = await apiInstance.get(`/admin/channel?${params.toString()}`, {
        signal,
      });
      const { dataList, pageInfo } = res.data.data;
      return { dataList, totalCount: pageInfo.totalCount };
    },
    deps: [isStaging, loginToken],
    pageSize: PAGE_SIZE,
    enabled: !!loginToken,
  });

  useEffect(() => {
    if (prodData.length > 0) fetchEpisodeCounts(prodData);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prodData]);

  const handleLoadAllChannels = async () => {
    if (!loginToken) return toast.warn('로그인을 먼저 해주세요!');
    const currentSheet = localStorage.getItem(storageKey) || selectedSheet;
    if (!currentSheet) return toast.warn('시트를 먼저 선택해주세요!');

    cancelOngoingWork();
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
      const sortedAllData = sortChannelsByCreatedAtDesc(allData);
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
      cancelOngoingWork();

      const newList = await getNewData(
        loginToken,
        accessToken,
        setProgress,
        CATEGORY,
        apiInstance,
        spreadsheetId
      );
      const sortedNewList = sortChannelsByCreatedAtDesc(newList);
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
    <div className='p-10 flex flex-col h-[90vh]'>
      <h1 className='text-3xl font-bold mb-4 indent-1'>
        채널·도서 관리{isStaging ? ' (스테이징)' : ''}
      </h1>
      <div className='w-full rounded-2xl bg-white mt-4 flex flex-col'>
        <TabHeader activeTab={activeTab} onChange={setActiveTab} />

        {activeTab === 'data' && (
          <div className='flex-1 p-8 flex flex-col'>
            <div className='flex justify-between items-center flex-shrink-0 mb-4'>
              <h3 className='text-point-color font-semibold'>
                채널·도서 총{' '}
                <span className='font-extrabold'>{prodTotalCount}</span>개
              </h3>
              <div className='flex items-center gap-6'>
                <UsageFilterRadio
                  name='channelUsageFilter'
                  value={usageFilter}
                  onChange={handleUsageFilterChange}
                />
                <input
                  type='text'
                  value={prodSearchQuery}
                  onChange={(e) => setProdSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder='채널명 검색'
                  className='border border-gray-300 px-4 py-2 rounded-lg text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition w-60'
                />
                <button
                  onClick={handleSearch}
                  className='cursor-pointer'
                  disabled={prodLoading}
                >
                  <img src='/redo.svg' alt='새로고침' width={22} height={22} />
                </button>
              </div>
            </div>
            <LoadingOverlay loading={prodLoading}>
              채널 목록을 불러오는 중입니다.
              <br />
              잠시만 기다려주세요!
            </LoadingOverlay>
            {!prodLoading && (
              <div className='overflow-x-scroll episode-table-scroll pb-1'>
                <ProdChannelList
                  data={prodData}
                  episodeCountByChannelId={episodeCountByChannelId}
                  latestEpisodeUploadByChannelId={
                    latestEpisodeUploadByChannelId
                  }
                  isStaging={isStaging}
                />
              </div>
            )}
            <Pagination
              page={prodPage}
              totalPages={prodTotalPages}
              onChange={handleProdPageChange}
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
                  <div className='overflow-x-scroll episode-table-scroll pb-1 flex-1'>
                    <ProdChannelList
                      data={syncDisplayData.slice(
                        (syncPage - 1) * SYNC_PAGE_SIZE,
                        syncPage * SYNC_PAGE_SIZE
                      )}
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
  );
};

export default ChannelLayout;
