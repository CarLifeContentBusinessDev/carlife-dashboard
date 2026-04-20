import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import Button from '../../components/Button';
import LoadingOverlay from '../../components/LoadingOverlay';
import Pagination from '../../components/Pagination';
import { useLoginTokenStore } from '../../store/useLoginTokenStore';
import type {
  curationListItemProps,
  usingCurationExcelProps,
} from '../../types/type';
import { api, stgApi } from '../../utils/api';
import { appendNewCurationToExcel } from '../../utils/appendNewCurationToExcel';
import { fetchAllCurationData } from '../../utils/fetchAllData';
import { getNewCurationData } from '../../utils/getNewCuration';
import getSheetList from '../../utils/getSheetList';
import { mapCurationStatus } from '../../utils/statusMapper';
import { updateSheetSyncTime } from '../../utils/updateSheetSyncTime';
import { overwriteCurationExcelData } from '../../utils/updateCuration';
import ProdCurationList from './ProdCurationList';

const DATA_PAGE_SIZE = 10;
const SYNC_PAGE_SIZE = 10;
type SyncPreviewMode = 'new' | 'all' | null;

type ProdCurationRow = usingCurationExcelProps & {
  curationId: number;
};

const CurationLayout = () => {
  const { pathname } = useLocation();
  const { loginToken } = useLoginTokenStore();
  const isStaging = pathname.startsWith('/stg');
  const [activeTab, setActiveTab] = useState<'data' | 'sync'>('data');
  const [prodData, setProdData] = useState<ProdCurationRow[]>([]);
  const [prodLoading, setProdLoading] = useState(false);
  const [prodPage, setProdPage] = useState(1);
  const [prodTotalPages, setProdTotalPages] = useState(0);
  const [prodTotalCount, setProdTotalCount] = useState(0);
  const [newCurations, setNewCurations] = useState<usingCurationExcelProps[]>(
    []
  );
  const [allCurations, setAllCurations] = useState<usingCurationExcelProps[]>(
    []
  );
  const [syncPreviewMode, setSyncPreviewMode] = useState<SyncPreviewMode>(null);
  const [syncPage, setSyncPage] = useState(1);
  const [syncTotalPages, setSyncTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [excelLoading, setExcelLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [sheetList, setSheetList] = useState<{ id: string; name: string }[]>(
    []
  );
  const defaultSheetName = isStaging ? 'stg_큐레이션 DB' : '큐레이션 DB';
  const sheetStorageKey = isStaging
    ? 'sheetName:curation:stg'
    : 'sheetName:curation:prod';
  const [selectedSheet, setSelectedSheet] = useState(
    localStorage.getItem(sheetStorageKey) || defaultSheetName
  );

  const apiInstance = isStaging ? stgApi : api;

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

  const fetchProdCurationPage = async (page: number) => {
    if (!loginToken) return;

    setProdLoading(true);

    try {
      const listRes = await apiInstance.get(
        `/admin/curation?page=${page}&size=${DATA_PAGE_SIZE}&periodType=ALL`
      );

      const { dataList, pageInfo } = listRes.data.data as {
        dataList: curationListItemProps[];
        pageInfo: { totalCount: number };
      };

      setProdTotalCount(pageInfo.totalCount ?? 0);
      setProdTotalPages(Math.ceil((pageInfo.totalCount ?? 0) / DATA_PAGE_SIZE));

      const rows: ProdCurationRow[] = (dataList ?? []).map((listItem) => ({
        curationId: listItem.curationId,
        thumbnailTitle: '',
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
      }));

      setProdData(rows);
    } catch (error) {
      console.error('큐레이션 데이터 조회 실패:', error);
      setProdData([]);
      setProdTotalCount(0);
      setProdTotalPages(0);
    } finally {
      setProdLoading(false);
    }
  };

  useEffect(() => {
    setProdPage(1);
    fetchProdCurationPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStaging, loginToken]);

  const handleProdPageChange = (page: number) => {
    setProdPage(page);
    fetchProdCurationPage(page);
  };

  const handleSyncPageChange = (page: number) => {
    setSyncPage(page);
  };

  const handleSelectSheetDropdown = (value: string) => {
    setSelectedSheet(value);
    localStorage.setItem(sheetStorageKey, value);
  };

  const handleLoadAllCurations = async () => {
    if (!loginToken) return toast.warn('로그인을 먼저 해주세요!');

    const currentSheet = localStorage.getItem(sheetStorageKey) || selectedSheet;
    if (!currentSheet) {
      return toast.warn('시트를 먼저 선택해주세요!');
    }

    try {
      setLoading(true);
      setAllCurations([]);
      setNewCurations([]);
      setSyncPreviewMode(null);
      setSyncPage(1);

      const allData = await fetchAllCurationData(apiInstance);
      setAllCurations(allData);
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

  const handleSearchNew = async (token: string) => {
    if (!loginToken) return toast.warn('로그인을 먼저 해주세요!');

    const currentSheet = localStorage.getItem(sheetStorageKey) || selectedSheet;
    if (!currentSheet) {
      return toast.warn('시트를 먼저 선택해주세요!');
    }

    try {
      setLoading(true);
      setNewCurations([]);
      setAllCurations([]);
      setSyncPreviewMode(null);
      setSyncPage(1);

      const newList = await getNewCurationData(
        token,
        setProgress,
        apiInstance,
        spreadsheetId,
        currentSheet
      );
      setNewCurations(newList);
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

    const currentSheet = localStorage.getItem(sheetStorageKey) || selectedSheet;
    if (!currentSheet) {
      return toast.warn('시트를 먼저 선택해주세요!');
    }

    if (!syncPreviewMode) {
      return toast.warn('먼저 신규 또는 전체 조회를 실행해주세요!');
    }

    const previewData = syncPreviewMode === 'new' ? newCurations : allCurations;

    if (syncPreviewMode === 'new' && previewData.length === 0) {
      return toast.info('동기화할 신규 데이터가 없습니다.');
    }

    const confirmMessage =
      syncPreviewMode === 'new'
        ? `${currentSheet} 시트에 신규 ${previewData.length}건을 추가합니다. 계속하시겠습니까?`
        : `${currentSheet} 시트의 기존 데이터를 삭제하고 ${previewData.length}건으로 전체 재적재합니다. 계속하시겠습니까?`;

    const confirmed = window.confirm(confirmMessage);
    if (!confirmed) {
      return;
    }

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

  return (
    <div className='p-10 flex flex-col h-[90vh]'>
      <h1 className='text-3xl font-bold mb-4 indent-1'>
        큐레이션 관리{isStaging ? ' (스테이징)' : ''}
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
                큐레이션 총{' '}
                <span className='font-extrabold'>{prodTotalCount}</span>개
              </h3>

              <button
                onClick={() => handleProdPageChange(prodPage)}
                className='cursor-pointer'
                disabled={prodLoading}
              >
                <img src='/redo.svg' alt='새로고침' width={22} height={22} />
              </button>
            </div>

            <LoadingOverlay loading={prodLoading}>
              큐레이션 목록을 불러오는 중입니다.
              <br />
              잠시만 기다려주세요!
            </LoadingOverlay>

            {!prodLoading && (
              <div className='overflow-x-scroll episode-table-scroll pb-1'>
                <ProdCurationList data={prodData} isStaging={isStaging} />
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
              <div className='flex gap-2'>
                <Button onClick={() => handleSearchNew(loginToken)}>
                  신규 조회
                </Button>
                <Button onClick={handleLoadAllCurations}>전체 조회</Button>
                <Button
                  href={
                    isStaging
                      ? `https://docs.google.com/spreadsheets/d/${import.meta.env.VITE_STG_SPREADSHEET_ID}/edit?gid=1243772316#gid=1243772316`
                      : `https://docs.google.com/spreadsheets/d/${import.meta.env.VITE_SPREADSHEET_ID}/edit?gid=991347809#gid=991347809`
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
                <Button onClick={handleSyncExcel} disabled={!syncPreviewMode}>
                  동기화 실행
                </Button>
              </div>
            </div>
            <div className='flex justify-between items-center flex-shrink-0'>
              <h3 className='text-point-color font-semibold'>
                {syncPreviewMode === 'all' && (
                  <>
                    전체 동기화 대상 총{' '}
                    <span className='font-extrabold'>
                      {allCurations.length}
                    </span>
                    개
                  </>
                )}
                {syncPreviewMode === 'new' && (
                  <>
                    신규 동기화 대상 총{' '}
                    <span className='font-extrabold'>
                      {newCurations.length}
                    </span>
                    개
                  </>
                )}
                {syncPreviewMode === null && (
                  <>신규/전체 조회 후 결과를 확인하고 동기화를 실행하세요.</>
                )}
              </h3>
              <div className='flex gap-8 items-center'>
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
                  <div className='overflow-x-scroll episode-table-scroll pb-1 flex-1'>
                    {syncPreviewMode === 'new' ? (
                      <ProdCurationList
                        data={
                          newCurations
                            .slice(
                              (syncPage - 1) * SYNC_PAGE_SIZE,
                              syncPage * SYNC_PAGE_SIZE
                            )
                            .map((item, idx) => ({
                              ...item,
                              curationId: idx,
                            })) as any
                        }
                        isStaging={isStaging}
                      />
                    ) : (
                      <ProdCurationList
                        data={
                          allCurations
                            .slice(
                              (syncPage - 1) * SYNC_PAGE_SIZE,
                              syncPage * SYNC_PAGE_SIZE
                            )
                            .map((item, idx) => ({
                              ...item,
                              curationId: idx,
                            })) as any
                        }
                        isStaging={isStaging}
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

export default CurationLayout;
