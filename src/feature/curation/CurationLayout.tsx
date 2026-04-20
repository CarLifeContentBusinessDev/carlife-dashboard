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
import { addMissingCurationRows } from '../../utils/updateCuration';
import CurationList from './CurationList';
import ProdCurationList from './ProdCurationList';

const DATA_PAGE_SIZE = 10;
type ActiveFilter = 'all' | 'Y' | 'N';
type ExhibitionFilter =
  | 'all'
  | 'ACTIVE'
  | 'ACTIVE_NONE_DISPLAY'
  | 'INACTIVE'
  | 'WAITING';

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
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('all');
  const [exhibitionFilter, setExhibitionFilter] =
    useState<ExhibitionFilter>('all');
  const [newCurations, setNewCurations] = useState<usingCurationExcelProps[]>(
    []
  );
  const [loading, setLoading] = useState(false);
  const [excelLoading, setExcelLoading] = useState(false);
  const [allLoading, setAllLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [syncCompleted, setSyncCompleted] = useState(false);
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

  const fetchProdCurationPage = async (
    page: number,
    nextActiveFilter: ActiveFilter,
    nextExhibitionFilter: ExhibitionFilter
  ) => {
    if (!loginToken) return;

    setProdLoading(true);

    try {
      const queryParams = new URLSearchParams({
        page: String(page),
        size: String(DATA_PAGE_SIZE),
        periodType: 'ALL',
      });

      if (nextActiveFilter !== 'all') {
        queryParams.set('usageYn', nextActiveFilter);
      }

      if (nextExhibitionFilter !== 'all') {
        queryParams.set('status', nextExhibitionFilter);
      }

      const listRes = await apiInstance.get(
        `/admin/curation?${queryParams.toString()}`
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
    fetchProdCurationPage(1, activeFilter, exhibitionFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStaging, loginToken, activeFilter, exhibitionFilter]);

  const handleProdPageChange = (page: number) => {
    setProdPage(page);
    fetchProdCurationPage(page, activeFilter, exhibitionFilter);
  };

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
      setAllLoading(true);
      const allData = await fetchAllCurationData(apiInstance);
      await addMissingCurationRows(
        allData,
        loginToken,
        setProgress,
        spreadsheetId
      );
      setProgress('');
      setAllLoading(false);
    }
  };

  const handleSyncExcel = async () => {
    if (!loginToken) return toast.warn('로그인을 먼저 해주세요!');

    const currentSheet = localStorage.getItem(sheetStorageKey) || selectedSheet;
    if (!currentSheet) {
      return toast.warn('시트를 먼저 선택해주세요!');
    }

    try {
      await appendNewCurationToExcel(
        newCurations,
        setProgress,
        setExcelLoading,
        currentSheet,
        spreadsheetId
      );
      await updateSheetSyncTime(defaultSheetName, spreadsheetId);
      setSyncCompleted(true);
    } catch (error) {
      console.error('Excel 동기화 실패:', error);
    } finally {
      setExcelLoading(false);
      setProgress('');
    }
  };

  const handleSearchNew = async (token: string) => {
    setLoading(true);
    setSyncCompleted(false);
    const newList = await getNewCurationData(
      token,
      setProgress,
      apiInstance,
      spreadsheetId
    );
    setProgress('');
    setNewCurations(newList);
    setLoading(false);
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

              <div className='flex items-center gap-8'>
                <div className='flex items-center gap-3'>
                  <span className='text-sm text-gray-600 font-medium'>
                    활성 상태:
                  </span>

                  <label className='flex items-center gap-1.5 cursor-pointer'>
                    <input
                      type='radio'
                      name='curationActiveFilter'
                      value='all'
                      checked={activeFilter === 'all'}
                      onChange={() => setActiveFilter('all')}
                      className='accent-point-color w-4 h-4 cursor-pointer'
                    />
                    <span className='text-sm text-gray-700'>All</span>
                  </label>

                  <label className='flex items-center gap-1.5 cursor-pointer'>
                    <input
                      type='radio'
                      name='curationActiveFilter'
                      value='Y'
                      checked={activeFilter === 'Y'}
                      onChange={() => setActiveFilter('Y')}
                      className='accent-point-color w-4 h-4 cursor-pointer'
                    />
                    <span className='text-sm text-gray-700'>Y</span>
                  </label>

                  <label className='flex items-center gap-1.5 cursor-pointer'>
                    <input
                      type='radio'
                      name='curationActiveFilter'
                      value='N'
                      checked={activeFilter === 'N'}
                      onChange={() => setActiveFilter('N')}
                      className='accent-point-color w-4 h-4 cursor-pointer'
                    />
                    <span className='text-sm text-gray-700'>N</span>
                  </label>
                </div>

                <div className='flex items-center gap-3'>
                  <span className='text-sm text-gray-600 font-medium'>
                    전시 상태:
                  </span>

                  <label className='flex items-center gap-1.5 cursor-pointer'>
                    <input
                      type='radio'
                      name='curationExhibitionFilter'
                      value='all'
                      checked={exhibitionFilter === 'all'}
                      onChange={() => setExhibitionFilter('all')}
                      className='accent-point-color w-4 h-4 cursor-pointer'
                    />
                    <span className='text-sm text-gray-700'>All</span>
                  </label>

                  <label className='flex items-center gap-1.5 cursor-pointer'>
                    <input
                      type='radio'
                      name='curationExhibitionFilter'
                      value='ACTIVE'
                      checked={exhibitionFilter === 'ACTIVE'}
                      onChange={() => setExhibitionFilter('ACTIVE')}
                      className='accent-point-color w-4 h-4 cursor-pointer'
                    />
                    <span className='text-sm text-gray-700'>게시 중</span>
                  </label>

                  <label className='flex items-center gap-1.5 cursor-pointer'>
                    <input
                      type='radio'
                      name='curationExhibitionFilter'
                      value='ACTIVE_NONE_DISPLAY'
                      checked={exhibitionFilter === 'ACTIVE_NONE_DISPLAY'}
                      onChange={() =>
                        setExhibitionFilter('ACTIVE_NONE_DISPLAY')
                      }
                      className='accent-point-color w-4 h-4 cursor-pointer'
                    />
                    <span className='text-sm text-gray-700'>게시 대기</span>
                  </label>

                  <label className='flex items-center gap-1.5 cursor-pointer'>
                    <input
                      type='radio'
                      name='curationExhibitionFilter'
                      value='INACTIVE'
                      checked={exhibitionFilter === 'INACTIVE'}
                      onChange={() => setExhibitionFilter('INACTIVE')}
                      className='accent-point-color w-4 h-4 cursor-pointer'
                    />
                    <span className='text-sm text-gray-700'>게시 종료</span>
                  </label>

                  <label className='flex items-center gap-1.5 cursor-pointer'>
                    <input
                      type='radio'
                      name='curationExhibitionFilter'
                      value='WAITING'
                      checked={exhibitionFilter === 'WAITING'}
                      onChange={() => setExhibitionFilter('WAITING')}
                      className='accent-point-color w-4 h-4 cursor-pointer'
                    />
                    <span className='text-sm text-gray-700'>게시 예약</span>
                  </label>
                </div>

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
            <div className='flex gap-2 mb-4 flex-shrink-0'>
              <Button onClick={handleUpdateExcel}>
                전체 큐레이션 시트로 변환
              </Button>
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
              <LoadingOverlay
                progress={progress}
                vertical={false}
                loading={allLoading}
              ></LoadingOverlay>
            </div>
            <div className='flex justify-between items-center flex-shrink-0'>
              <h3 className='text-point-color font-semibold'>
                새로운 큐레이션 총{' '}
                <span className='font-extrabold'>{newCurations.length}</span>개
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
                  onClick={() => handleSearchNew(loginToken)}
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
            <div className='w-full flex-1 flex flex-col mt-4 min-h-0'>
              <LoadingOverlay progress={progress} loading={loading}>
                새로운 큐레이션 목록을 불러오는 중입니다.
                <br />
                잠시만 기다려주세요!
              </LoadingOverlay>
              {!loading && <CurationList data={newCurations} />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CurationLayout;
