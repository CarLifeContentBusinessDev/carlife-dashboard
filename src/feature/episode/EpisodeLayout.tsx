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
import { addMissingRows } from '../../utils/updateExcel';
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
  const [newEpi, setNewEpi] = useState<usingDataProps[]>([]);
  const [duplicateNewEpi, setDuplicateNewEpi] = useState<usingDataProps[]>([]);
  const [loading, setLoading] = useState(false);
  const [excelLoading, setExcelLoading] = useState(false);
  const [allLoading, setAllLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [syncCompleted, setSyncCompleted] = useState(false);
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

  const handleUpdateExcel = async () => {
    if (!loginToken) return toast.warn('로그인을 먼저 해주세요!');
    const result = window.confirm(
      `${selectedSheet || '선택된'} 시트에 누락된 데이터를 추가합니다.`
    );
    if (result) {
      const currentSheet =
        localStorage.getItem(sheetStorageKey) || selectedSheet;
      if (!currentSheet) {
        return toast.warn('시트를 먼저 선택해주세요!');
      }

      const allData = await fetchAllData(
        CATEGORY,
        setProgress,
        undefined,
        apiInstance
      );
      const duplicateData = await findChangedData(allData);
      await addMissingRows(
        allData,
        loginToken,
        setProgress,
        CATEGORY,
        setAllLoading,
        spreadsheetId,
        currentSheet
      );

      localStorage.setItem(sheetStorageKey, getSheetName('Episode_Logs'));
      setSelectedSheet(getSheetName('Episode_Logs'));
      await addMissingRows(
        duplicateData,
        loginToken,
        setProgress,
        CATEGORY,
        setAllLoading,
        spreadsheetId,
        getSheetName('Episode_Logs')
      );
    }
  };

  const handleSyncExcel = async () => {
    if (!loginToken) return toast.warn('로그인을 먼저 해주세요!');

    // 선택된 시트에 새 데이터 추가
    const currentSheet = localStorage.getItem(sheetStorageKey) || selectedSheet;
    if (!currentSheet) {
      return toast.warn('시트를 먼저 선택해주세요!');
    }

    try {
      setExcelLoading(true);

      await appendNewDataToTop(
        newEpi,
        setProgress,
        CATEGORY,
        setExcelLoading,
        currentSheet,
        false, // 토스트 메시지 표시 안 함
        spreadsheetId
      );

      // Episode_Logs 시트에 변경된 데이터 추가
      if (duplicateNewEpi.length > 0) {
        setProgress(
          `Episode_Logs 시트에 변경된 데이터 ${duplicateNewEpi.length}개 추가 중...`
        );

        localStorage.setItem(sheetStorageKey, getSheetName('Episode_Logs'));
        setSelectedSheet(getSheetName('Episode_Logs'));

        await appendNewDataToTop(
          duplicateNewEpi,
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
        `새로운 에피소드 ${newEpi.length}개, 변경된 에피소드 ${duplicateNewEpi.length}개 \n 동기화에 성공했습니다!`
      );
      setSyncCompleted(true);
    } catch (error) {
      console.error('Excel 동기화 실패:', error);
    } finally {
      setExcelLoading(false);
      setProgress('');
    }
  };

  const PROD_PAGE_SIZE = 10;

  const fetchProdPage = async (page: number) => {
    if (!loginToken) return;
    setProdLoading(true);
    try {
      const res = await apiInstance.get(
        `/admin/episode?page=${page}&size=${PROD_PAGE_SIZE}`
      );
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
    fetchProdPage(page);
  };

  useEffect(() => {
    setProdPage(1);
    fetchProdPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStaging, loginToken]);

  const handleSearchNew = async () => {
    setLoading(true);
    setSyncCompleted(false);
    const newList = await getNewDataWithExcel(
      setProgress,
      apiInstance,
      spreadsheetId
    );
    const duplicateNewData = await findUpdateData(newList, setProgress);
    setProgress('');
    setNewEpi(newList);
    setDuplicateNewEpi(duplicateNewData);
    setLoading(false);
  };

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
                에피소드 총{' '}
                <span className='font-extrabold'>{prodTotalCount}</span>개
              </h3>
              <div className='flex gap-4 items-center'>
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
                  data={
                    prodSearchQuery
                      ? prodData.filter((ep) =>
                          ep.episodeName
                            ?.toLowerCase()
                            .includes(prodSearchQuery.toLowerCase())
                        )
                      : prodData
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

        {/* 탭 2: Excel 동기화 */}
        {activeTab === 'sync' && (
          <div className='flex-1 p-8 flex flex-col min-h-0'>
            <div className='flex gap-2 mb-4 flex-shrink-0'>
              <Button onClick={handleUpdateExcel}>
                전체 에피소드 시트로 변환
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
              <LoadingOverlay
                progress={progress}
                vertical={false}
                loading={allLoading}
              />
            </div>
            <div className='flex justify-between items-center flex-shrink-0'>
              <h3 className='text-point-color font-semibold'>
                새로운 에피소드 총{' '}
                <span className='font-extrabold'>{newEpi.length}</span>개
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
                <button
                  onClick={() => handleSearchNew()}
                  className='cursor-pointer'
                >
                  <img src='/redo.svg' alt='재검색' width={22} height={22} />
                </button>
                <Button
                  onClick={handleSyncExcel}
                  disabled={excelLoading || syncCompleted}
                >
                  {syncCompleted ? 'Excel 동기화 완료' : 'Excel 동기화'}
                </Button>
              </div>
            </div>
            <div className='w-full flex-1 gap-4 flex flex-col mt-4 min-h-0'>
              <LoadingOverlay progress={progress} loading={loading}>
                새로운 에피소드 목록을 불러오는 중입니다.
                <br />
                잠시만 기다려주세요!
              </LoadingOverlay>

              {!loading && <EpisodeList data={newEpi} />}

              <h2 className='mt-6 text-point-color font-semibold flex-shrink-0'>
                변경된 에피소드 총{' '}
                <span className='font-extrabold'>{duplicateNewEpi.length}</span>
                개
              </h2>
              {!loading && <EpisodeList data={duplicateNewEpi} />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EpisodeLayout;
