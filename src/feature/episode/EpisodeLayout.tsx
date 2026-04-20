import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import Button from '../../components/Button';
import LoadingOverlay from '../../components/LoadingOverlay';
import Pagination from '../../components/Pagination';
import { useLoginTokenStore } from '../../store/useLoginTokenStore';
import type { usingDataProps } from '../../types/type';
import { api, stgApi } from '../../utils/api';
import { appendNewDataToTop } from '../../utils/appendNewDataToExcel';
import { fetchAllData } from '../../utils/fetchAllData';
import { getNewDataWithExcel } from '../../utils/getNewData';
import getSheetList from '../../utils/getSheetList';
import { updateSheetSyncTime } from '../../utils/updateSheetSyncTime';
import { findChangedData, findUpdateData } from '../../utils/updateLogs';
import EpisodeList from './EpisodeList';
import ProdEpisodeList from './ProdEpisodeList';

const CATEGORY = 'episode';

const EpisodeLayout = () => {
  const { pathname } = useLocation();
  const { loginToken } = useLoginTokenStore();
  const isStaging = pathname.startsWith('/stg');
  const [activeTab, setActiveTab] = useState<'data' | 'sync'>('data');
  const [prodData, setProdData] = useState<usingDataProps[]>([]);
  const [prodLoading, setProdLoading] = useState(false);
  const [prodPage, setProdPage] = useState(1);
  const [prodTotalPages, setProdTotalPages] = useState(0);
  const [prodTotalCount, setProdTotalCount] = useState(0);
  const [prodSearchQuery, setProdSearchQuery] = useState('');
  const [usageFilter, setUsageFilter] = useState<'all' | 'Y' | 'N'>('all');
  const [newEpi, setNewEpi] = useState<usingDataProps[]>([]);
  const [duplicateNewEpi, setDuplicateNewEpi] = useState<usingDataProps[]>([]);
  const [allEpisodes, setAllEpisodes] = useState<usingDataProps[]>([]);
  const [duplicateAllEpisodes, setDuplicateAllEpisodes] = useState<
    usingDataProps[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [excelLoading, setExcelLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [syncPreviewMode, setSyncPreviewMode] = useState<'new' | 'all' | null>(
    null
  );
  const [syncPage, setSyncPage] = useState(1);
  const [syncTotalPages, setSyncTotalPages] = useState(0);
  const [sheetList, setSheetList] = useState<{ id: string; name: string }[]>(
    []
  );
  const defaultSheetName = isStaging ? 'stg_에피소드 DB' : '에피소드 DB';
  const sheetStorageKey = isStaging
    ? 'sheetName:episode:stg'
    : 'sheetName:episode:prod';
  const [selectedSheet, setSelectedSheet] = useState(
    localStorage.getItem(sheetStorageKey) || defaultSheetName
  );

  const apiInstance = isStaging ? stgApi : api;

  const getSheetName = (name: string) => (isStaging ? `stg_${name}` : name);
  const spreadsheetId = isStaging
    ? import.meta.env.VITE_STG_SPREADSHEET_ID
    : import.meta.env.VITE_SPREADSHEET_ID;

  useEffect(() => {
    if (loginToken) {
      getSheetList(spreadsheetId).then((list) => {
        setSheetList(list);

        const filteredSheets = list.filter((sheet) =>
          isStaging
            ? sheet.name.startsWith('stg_')
            : !sheet.name.startsWith('stg_')
        );
        const savedSheet = localStorage.getItem(sheetStorageKey);
        const isSavedSheetValid = filteredSheets.some(
          (sheet) => sheet.name === savedSheet
        );
        const hasDefaultSheet = filteredSheets.some(
          (sheet) => sheet.name === defaultSheetName
        );

        const nextSheet = isSavedSheetValid
          ? savedSheet!
          : hasDefaultSheet
            ? defaultSheetName
            : '';

        setSelectedSheet(nextSheet);
        if (nextSheet) {
          localStorage.setItem(sheetStorageKey, nextSheet);
        } else {
          localStorage.removeItem(sheetStorageKey);
        }
      });
    }
  }, [defaultSheetName, isStaging, loginToken, sheetStorageKey, spreadsheetId]);

  const handleSelectSheetDropdown = (value: string) => {
    setSelectedSheet(value);
    localStorage.setItem(sheetStorageKey, value);
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
      // 전체 조회 시 Episode_Logs 비우기
      if (loginToken) {
        setProgress('기존 로그 데이터 초기화 중...');
        try {
          const logsSheetName = getSheetName('Episode_Logs');
          // 로그 시트 초기화 (appendNewDataToTop의 overwrite 동작 사용)
          await appendNewDataToTop(
            [],
            setProgress,
            CATEGORY,
            setLoading,
            logsSheetName,
            true, // overwrite
            spreadsheetId
          );
        } catch (error) {
          console.warn('Episode_Logs 초기화 실패:', error);
        }
      }
      setProgress('');
      setAllEpisodes(allList);
      setDuplicateAllEpisodes(duplicateData);
      setSyncPreviewMode('all');
      setSyncPage(1);
      setSyncTotalPages(Math.ceil(allList.length / SYNC_PAGE_SIZE));
    } finally {
      setLoading(false);
    }
  };

  const handleSyncExcel = async () => {
    if (!loginToken) return toast.warn('로그인을 먼저 해주세요!');
    if (!syncPreviewMode)
      return toast.warn('신규/전체 조회를 먼저 실행해주세요!');

    // 선택된 시트에 새 데이터 추가
    const currentSheet = localStorage.getItem(sheetStorageKey) || selectedSheet;
    if (!currentSheet) {
      return toast.warn('시트를 먼저 선택해주세요!');
    }

    try {
      setExcelLoading(true);

      const dataToSync = syncPreviewMode === 'new' ? newEpi : allEpisodes;
      const duplicateToSync =
        syncPreviewMode === 'new' ? duplicateNewEpi : duplicateAllEpisodes;

      await appendNewDataToTop(
        dataToSync,
        setProgress,
        CATEGORY,
        setExcelLoading,
        currentSheet,
        false, // 토스트 메시지 표시 안 함
        spreadsheetId
      );

      // Episode_Logs 시트에 변경된 데이터 추가
      if (duplicateToSync.length > 0) {
        setProgress(
          `Episode_Logs 시트에 변경된 데이터 ${duplicateToSync.length}개 추가 중...`
        );

        localStorage.setItem(sheetStorageKey, getSheetName('Episode_Logs'));
        setSelectedSheet(getSheetName('Episode_Logs'));

        await appendNewDataToTop(
          duplicateToSync,
          setProgress,
          CATEGORY,
          setExcelLoading,
          getSheetName('Episode_Logs'),
          false,
          spreadsheetId
        );
      }

      await updateSheetSyncTime(defaultSheetName, spreadsheetId);

      // 모든 작업 완료 후 통합 토스트 메시지
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

  const PROD_PAGE_SIZE = 10;
  const SYNC_PAGE_SIZE = 10;

  const handleSyncPageChange = (page: number) => {
    setSyncPage(page);
  };

  const fetchProdPage = async (page: number, filter: 'all' | 'Y' | 'N') => {
    if (!loginToken) return;
    setProdLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        size: String(PROD_PAGE_SIZE),
      });

      if (filter !== 'all') {
        params.set('usageYn', filter);
      }

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
      const newList = await getNewDataWithExcel(
        setProgress,
        apiInstance,
        spreadsheetId
      );
      const duplicateNewData = await findUpdateData(newList, setProgress);
      setProgress('');
      setNewEpi(newList);
      setDuplicateNewEpi(duplicateNewData);
      setSyncPreviewMode('new');
      setSyncPage(1);
      setSyncTotalPages(Math.ceil(newList.length / SYNC_PAGE_SIZE));
    } finally {
      setLoading(false);
    }
  };

  const filteredProdData = prodData.filter((ep) => {
    if (!prodSearchQuery) return true;
    return ep.episodeName
      ?.toLowerCase()
      .includes(prodSearchQuery.toLowerCase());
  });

  const isSearchFiltered = prodSearchQuery.trim().length > 0;

  return (
    <div className='p-10 flex flex-col h-full'>
      <h1 className='text-3xl font-bold mb-4 indent-1'>
        에피소드 관리{isStaging ? ' (스테이징)' : ''}
      </h1>
      <div className='w-full rounded-2xl bg-white mt-4 flex flex-col'>
        {/* 탭 헤더 */}
        <div className='flex border-b border-gray-200 flex-shrink-0'>
          <button
            onClick={() => setActiveTab('data')}
            className={`px-6 py-4 text-sm font-semibold transition cursor-pointer ${
              activeTab === 'data'
                ? 'text-point-color border-b-2 border-point-color'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            데이터 조회
          </button>
          <button
            onClick={() => setActiveTab('sync')}
            className={`px-6 py-4 text-sm font-semibold transition cursor-pointer ${
              activeTab === 'sync'
                ? 'text-point-color border-b-2 border-point-color'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Excel 동기화
          </button>
        </div>

        {/* 탭 1: 데이터 조회 */}
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
                <div className='flex items-center gap-3'>
                  <span className='text-sm text-gray-600 font-medium'>
                    활성화:
                  </span>

                  <label className='flex items-center gap-1.5 cursor-pointer'>
                    <input
                      type='radio'
                      name='usageFilter'
                      value='all'
                      checked={usageFilter === 'all'}
                      onChange={() => setUsageFilter('all')}
                      className='accent-point-color w-4 h-4 cursor-pointer'
                    />
                    <span className='text-sm text-gray-700'>All</span>
                  </label>

                  <label className='flex items-center gap-1.5 cursor-pointer'>
                    <input
                      type='radio'
                      name='usageFilter'
                      value='Y'
                      checked={usageFilter === 'Y'}
                      onChange={() => setUsageFilter('Y')}
                      className='accent-point-color w-4 h-4 cursor-pointer'
                    />
                    <span className='text-sm text-gray-700'>Y</span>
                  </label>

                  <label className='flex items-center gap-1.5 cursor-pointer'>
                    <input
                      type='radio'
                      name='usageFilter'
                      value='N'
                      checked={usageFilter === 'N'}
                      onChange={() => setUsageFilter('N')}
                      className='accent-point-color w-4 h-4 cursor-pointer'
                    />
                    <span className='text-sm text-gray-700'>N</span>
                  </label>
                </div>

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
                <ProdEpisodeList
                  data={filteredProdData}
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

        {/* 탭 2: Excel 동기화 */}
        {activeTab === 'sync' && (
          <div className='flex-1 p-8 flex flex-col min-h-0'>
            <div className='flex justify-between items-center gap-2 mb-4 flex-shrink-0'>
              <div className='flex gap-2 items-center'>
                <Button
                  onClick={() => handleSearchNew()}
                  disabled={excelLoading || loading}
                >
                  신규 조회
                </Button>
                <Button
                  onClick={handleLoadAllEpisodes}
                  disabled={excelLoading || loading}
                >
                  전체 조회
                </Button>
                <Button
                  href={
                    isStaging
                      ? `https://docs.google.com/spreadsheets/d/${import.meta.env.VITE_STG_SPREADSHEET_ID}/edit?gid=418216794#gid=418216794`
                      : `https://docs.google.com/spreadsheets/d/${import.meta.env.VITE_SPREADSHEET_ID}/edit?gid=1925187377#gid=1925187377`
                  }
                  target='_blank'
                  rel='noopener noreferrer'
                >
                  Excel 바로가기
                </Button>
              </div>
              <div className='flex gap-2 items-center'>
                <LoadingOverlay
                  progress={progress}
                  vertical={false}
                  loading={excelLoading}
                />
                <Button
                  onClick={handleSyncExcel}
                  disabled={!syncPreviewMode || excelLoading || loading}
                >
                  동기화 실행
                </Button>
              </div>
            </div>
            <div className='flex justify-between items-center flex-shrink-0 mb-4'>
              <h3 className='text-point-color font-semibold'>
                {syncPreviewMode === 'all' && (
                  <>
                    전체 동기화 대상 총{' '}
                    <span className='font-extrabold'>{allEpisodes.length}</span>
                    개
                  </>
                )}
                {syncPreviewMode === 'new' && (
                  <>
                    신규 동기화 대상 총{' '}
                    <span className='font-extrabold'>{newEpi.length}</span>개
                  </>
                )}
                {syncPreviewMode === null && (
                  <>신규/전체 조회 후 결과를 확인하고 동기화를 실행하세요.</>
                )}
              </h3>
              <div className='flex gap-8 items-center'>
                <LoadingOverlay
                  progress={progress}
                  vertical={false}
                  loading={excelLoading}
                />
                <select
                  value={selectedSheet}
                  onChange={(e) => handleSelectSheetDropdown(e.target.value)}
                  disabled={excelLoading || loading}
                  className='w-fit appearance-none border border-gray-300 px-4 py-2 pr-10 rounded-lg bg-white text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition cursor-pointer'
                >
                  <option value=''>시트 선택</option>
                  {sheetList
                    .filter((sheet) =>
                      isStaging
                        ? sheet.name.startsWith('stg_')
                        : !sheet.name.startsWith('stg_')
                    )
                    .map((sheet) => (
                      <option key={sheet.id} value={sheet.name}>
                        {sheet.name}
                      </option>
                    ))}
                </select>
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
                    {syncPreviewMode === 'new' && (
                      <EpisodeList
                        data={newEpi.slice(
                          (syncPage - 1) * SYNC_PAGE_SIZE,
                          syncPage * SYNC_PAGE_SIZE
                        )}
                      />
                    )}
                    {syncPreviewMode === 'all' && (
                      <EpisodeList
                        data={allEpisodes.slice(
                          (syncPage - 1) * SYNC_PAGE_SIZE,
                          syncPage * SYNC_PAGE_SIZE
                        )}
                      />
                    )}
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
