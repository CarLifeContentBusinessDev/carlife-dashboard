import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import LoadingOverlay from '../../components/LoadingOverlay';
import Pagination from '../../components/Pagination';
import SheetSelector from '../../components/SheetSelector';
import SyncCountHeader from '../../components/SyncCountHeader';
import SyncToolbar from '../../components/SyncToolbar';
import TabHeader from '../../components/TabHeader';
import UsageFilterRadio from '../../components/UsageFilterRadio';
import { useSheetSelection } from '../../hook/useSheetSelection';
import { useStagingEnv } from '../../hook/useStagingEnv';
import { useSyncState, SYNC_PAGE_SIZE } from '../../hook/useSyncState';
import { useLoginTokenStore } from '../../store/useLoginTokenStore';
import type { usingDataProps } from '../../types/type';
import { appendNewDataToTop } from '../../utils/appendNewDataToExcel';
import { fetchAllData } from '../../utils/fetchAllData';
import { getNewDataWithExcel } from '../../utils/getNewData';
import { updateSheetSyncTime } from '../../utils/updateSheetSyncTime';
import { clearExcelRange, overwriteExcelData } from '../../utils/updateExcel';
import { findChangedData, findUpdateData } from '../../utils/updateLogs';
import EpisodeList from './EpisodeList';
import ProdEpisodeList from './ProdEpisodeList';

const CATEGORY = 'episode';
const PROD_PAGE_SIZE = 10;

const EpisodeLayout = () => {
  const { isStaging, apiInstance, spreadsheetId } = useStagingEnv();
  const { loginToken } = useLoginTokenStore();
  const [activeTab, setActiveTab] = useState<'data' | 'sync'>('data');

  // 데이터 조회 탭
  const [prodData, setProdData] = useState<usingDataProps[]>([]);
  const [prodLoading, setProdLoading] = useState(false);
  const [prodPage, setProdPage] = useState(1);
  const [prodTotalPages, setProdTotalPages] = useState(0);
  const [prodTotalCount, setProdTotalCount] = useState(0);
  const [prodSearchQuery, setProdSearchQuery] = useState('');
  const [usageFilter, setUsageFilter] = useState<'all' | 'Y' | 'N'>('all');

  // 동기화 탭
  const [newEpi, setNewEpi] = useState<usingDataProps[]>([]);
  const [duplicateNewEpi, setDuplicateNewEpi] = useState<usingDataProps[]>([]);
  const [allEpisodes, setAllEpisodes] = useState<usingDataProps[]>([]);
  const [duplicateAllEpisodes, setDuplicateAllEpisodes] = useState<usingDataProps[]>([]);
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
  const storageKey = isStaging ? 'sheetName:episode:stg' : 'sheetName:episode:prod';
  const { sheetList, selectedSheet, setSelectedSheet, handleSelectSheet } =
    useSheetSelection({ isStaging, loginToken, spreadsheetId, defaultSheetName, storageKey });

  const getSheetName = (name: string) => (isStaging ? `stg_${name}` : name);

  const fetchProdPage = async (page: number, filter: 'all' | 'Y' | 'N') => {
    if (!loginToken) return;
    setProdLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        size: String(PROD_PAGE_SIZE),
      });
      if (filter !== 'all') params.set('usageYn', filter);
      const res = await apiInstance.get(`/admin/episode?${params.toString()}`);
      const { dataList, pageInfo } = res.data.data;
      setProdData(dataList);
      setProdTotalCount(pageInfo.totalCount);
      setProdTotalPages(Math.ceil(pageInfo.totalCount / PROD_PAGE_SIZE));
    } catch (e) {
      console.error('에피소드 데이터 조회 실패:', e);
    } finally {
      setProdLoading(false);
    }
  };

  const handleProdPageChange = (page: number) => {
    setProdPage(page);
    fetchProdPage(page, usageFilter);
  };

  useEffect(() => {
    setProdPage(1);
    fetchProdPage(1, usageFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStaging, loginToken, usageFilter]);

  const handleSearchNew = async () => {
    setLoading(true);
    try {
      const newList = await getNewDataWithExcel(setProgress, apiInstance, spreadsheetId);
      const duplicateNewData = await findUpdateData(newList, setProgress);
      setProgress('');
      setNewEpi(newList);
      setDuplicateNewEpi(duplicateNewData);
      setSyncPreviewMode('new');
      setSyncTotalPages(Math.ceil(newList.length / SYNC_PAGE_SIZE));
    } finally {
      setLoading(false);
    }
  };

  const handleLoadAllEpisodes = async () => {
    setLoading(true);
    try {
      const allList = await fetchAllData(CATEGORY, setProgress, undefined, apiInstance);
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
    if (!syncPreviewMode) return toast.warn('신규/전체 조회를 먼저 실행해주세요!');
    const currentSheet = localStorage.getItem(storageKey) || selectedSheet;
    if (!currentSheet) return toast.warn('시트를 먼저 선택해주세요!');

    try {
      setExcelLoading(true);
      const dataToSync = syncPreviewMode === 'new' ? newEpi : allEpisodes;
      const duplicateToSync =
        syncPreviewMode === 'new' ? duplicateNewEpi : duplicateAllEpisodes;

      if (syncPreviewMode === 'new') {
        await appendNewDataToTop(
          dataToSync, setProgress, CATEGORY, setExcelLoading, currentSheet, false, spreadsheetId
        );
      } else {
        await overwriteExcelData(
          dataToSync, loginToken, CATEGORY, currentSheet, spreadsheetId, 5
        );
        const logsSheetName = getSheetName('Episode_Logs');
        await clearExcelRange('B4:M300000', logsSheetName, spreadsheetId);
      }

      if (duplicateToSync.length > 0) {
        setProgress(`Episode_Logs 시트에 변경된 데이터 ${duplicateToSync.length}개 추가 중...`);
        const logsSheet = getSheetName('Episode_Logs');
        localStorage.setItem(storageKey, logsSheet);
        setSelectedSheet(logsSheet);
        await appendNewDataToTop(
          duplicateToSync, setProgress, CATEGORY, setExcelLoading, logsSheet, false, spreadsheetId
        );
      }

      await updateSheetSyncTime(defaultSheetName, spreadsheetId);
      toast.success(
        `에피소드 ${dataToSync.length}개, 변경된 에피소드 ${duplicateToSync.length}개 \n 동기화에 성공했습니다!`
      );
    } catch (error) {
      console.error('Excel 동기화 실패:', error);
    } finally {
      setExcelLoading(false);
      setProgress('');
    }
  };

  const filteredProdData = prodData.filter((ep) =>
    !prodSearchQuery ||
    ep.episodeName?.toLowerCase().includes(prodSearchQuery.toLowerCase())
  );
  const isSearchFiltered = prodSearchQuery.trim().length > 0;

  const excelHref = isStaging
    ? `https://docs.google.com/spreadsheets/d/${import.meta.env.VITE_STG_SPREADSHEET_ID}/edit?gid=418216794#gid=418216794`
    : `https://docs.google.com/spreadsheets/d/${import.meta.env.VITE_SPREADSHEET_ID}/edit?gid=1925187377#gid=1925187377`;

  return (
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
                {isSearchFiltered ? '조회 결과 ' : '에피소드 총 '}
                <span className='font-extrabold'>
                  {isSearchFiltered ? filteredProdData.length : prodTotalCount}
                </span>
                개
                {isSearchFiltered && (
                  <span className='ml-2 text-gray-500 text-sm'>
                    (전체 {prodTotalCount}개)
                  </span>
                )}
              </h3>
              <div className='flex gap-6 items-center'>
                <UsageFilterRadio
                  name='usageFilter'
                  value={usageFilter}
                  onChange={setUsageFilter}
                />
                <input
                  type='text'
                  value={prodSearchQuery}
                  onChange={(e) => setProdSearchQuery(e.target.value)}
                  placeholder='에피소드명 검색'
                  className='border border-gray-300 px-4 py-2 rounded-lg text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition w-60'
                />
                <button
                  onClick={() => handleProdPageChange(prodPage)}
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
                <ProdEpisodeList data={filteredProdData} isStaging={isStaging} />
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
                      data={(syncPreviewMode === 'new' ? newEpi : allEpisodes).slice(
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
              {!loading && !syncPreviewMode && (
                <div className='flex items-center justify-center h-full text-gray-500'>
                  신규/전체 조회를 먼저 실행해주세요.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EpisodeLayout;
