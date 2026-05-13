import { useState } from 'react';
import { toast } from 'react-toastify';
import LoadingOverlay from '../../../../components/common/LoadingOverlay';
import Pagination from '../../../../components/common/Pagination';
import SheetSelector from '../../../../components/filter/SheetSelector';
import SyncCountHeader from '../../../../components/sync/SyncCountHeader';
import SyncToolbar from '../../../../components/sync/SyncToolbar';
import TabHeader from '../../../../components/common/TabHeader';
import UsageFilterRadio from '../../../../components/filter/UsageFilterRadio';
import { useProdPagination } from '../../../../hook/useProdPagination';
import { useSheetSelection } from '../../../../hook/useSheetSelection';
import { useStagingEnv } from '../../../../hook/useStagingEnv';
import { useSyncState, SYNC_PAGE_SIZE } from '../../../../hook/useSyncState';
import { useLoginTokenStore } from '../../../../store/useLoginTokenStore';
import type { usingDataProps } from '../../../../types/type';
import { appendNewDataToTop } from '../../../../utils/excel/appendNewDataToExcel';
import { fetchAllData } from '../../../../utils/api/fetchAllData';
import { getNewDataWithExcel } from '../../../../utils/excel/getNewData';
import { updateSheetSyncTime } from '../../../../utils/excel/updateSheetSyncTime';
import {
  clearExcelRange,
  overwriteExcelData,
} from '../../../../utils/excel/updateExcel';
import { findChangedData } from '../../../../utils/excel/updateLogs';
import EpisodeList from './EpisodeList';
import ProdEpisodeList from './ProdEpisodeList';
import { SyncEmptyState } from '../../../../components/sync/SyncEmptyState';
import PickleLoginBanner from '../../../../components/common/PickleLoginBanner';

const CATEGORY = 'episode';
const PROD_PAGE_SIZE = 10;

const EpisodeLayout = () => {
  const { isStaging, apiInstance, spreadsheetId } = useStagingEnv();
  const { loginToken } = useLoginTokenStore();
  const [activeTab, setActiveTab] = useState<'data' | 'sync'>('data');

  // 동기화 탭
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
  } = useProdPagination<usingDataProps>({
    fetcher: async ({ page, filter, keyword, signal }) => {
      const params = new URLSearchParams({
        page: String(page),
        size: String(PROD_PAGE_SIZE),
      });
      if (filter !== 'All') params.set('usageYn', filter);
      if (keyword.trim()) params.set('keyword', keyword.trim());
      const res = await apiInstance.get(`/admin/episode?${params.toString()}`, {
        signal,
      });
      const { dataList, pageInfo } = res.data.data;
      return { dataList, totalCount: pageInfo.totalCount };
    },
    deps: [isStaging, loginToken],
    pageSize: PROD_PAGE_SIZE,
    enabled: !!loginToken,
  });

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
      const duplicateToSync =
        syncPreviewMode === 'new' ? duplicateNewEpi : duplicateAllEpisodes;
      const shouldAppendLogs =
        syncPreviewMode === 'new' && duplicateToSync.length > 0;

      if (syncPreviewMode === 'new') {
        await appendNewDataToTop(
          dataToSync,
          setProgress,
          CATEGORY,
          setExcelLoading,
          currentSheet,
          false,
          spreadsheetId
        );
      } else {
        await overwriteExcelData(
          dataToSync,
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
        const logsSheet = getSheetName('Episode_Logs');
        setProgress(
          `Episode_Logs 시트에 변경된 데이터 ${duplicateToSync.length}개 추가 중...`
        );
        await appendNewDataToTop(
          duplicateToSync,
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
          <div className='flex-1 p-8 flex flex-col'>
            <div className='flex justify-between items-center flex-shrink-0 mb-4'>
              <h3 className='text-point-color font-semibold'>
                에피소드 총{' '}
                <span className='font-extrabold'>{prodTotalCount}</span>개
              </h3>
              <div className='flex gap-6 items-center'>
                <UsageFilterRadio
                  name='usageFilter'
                  value={usageFilter}
                  onChange={handleUsageFilterChange}
                />
                <input
                  type='text'
                  value={prodSearchQuery}
                  onChange={(e) => setProdSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder='에피소드명 검색'
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
              에피소드 목록을 불러오는 중입니다.
              <br />
              잠시만 기다려주세요!
            </LoadingOverlay>
            {!prodLoading && (
              <div className='overflow-x-scroll episode-table-scroll pb-1'>
                <ProdEpisodeList data={prodData} isStaging={isStaging} />
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
