import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import Button from '../../components/Button';
import LoadingOverlay from '../../components/LoadingOverlay';
import Pagination from '../../components/Pagination';
import { useAccessTokenStore } from '../../store/useAccessTokenStore';
import { useLoginTokenStore } from '../../store/useLoginTokenStore';
import type { usingChannelProps } from '../../types/type';
import { api, stgApi } from '../../utils/api';
import { appendNewDataToTop } from '../../utils/appendNewDataToExcel';
import { fetchAllData } from '../../utils/fetchAllData';
import { getNewData } from '../../utils/getNewData';
import getSheetList from '../../utils/getSheetList';
import { updateSheetSyncTime } from '../../utils/updateSheetSyncTime';
import { overwriteExcelData } from '../../utils/updateExcel';
import ProdChannelList from './ProdChannelList.tsx';

const CATEGORY = 'channel';
type SyncPreviewMode = 'new' | 'all' | null;

const sortChannelsByCreatedAtDesc = (channels: usingChannelProps[]) => {
  return [...channels].sort((a, b) => {
    const createdA = new Date(a.createdAt).getTime();
    const createdB = new Date(b.createdAt).getTime();
    return createdB - createdA;
  });
};

const ChannelLayout = () => {
  const { pathname } = useLocation();
  const { loginToken } = useLoginTokenStore();
  const { accessToken } = useAccessTokenStore();
  const isStaging = pathname.startsWith('/stg');
  const [activeTab, setActiveTab] = useState<'data' | 'sync'>('data');
  const [prodData, setProdData] = useState<usingChannelProps[]>([]);
  const [prodLoading, setProdLoading] = useState(false);
  const [prodPage, setProdPage] = useState(1);
  const [prodTotalPages, setProdTotalPages] = useState(0);
  const [prodTotalCount, setProdTotalCount] = useState(0);
  const [episodeCountByChannelId, setEpisodeCountByChannelId] = useState<
    Record<number, number>
  >({});
  const [latestEpisodeUploadByChannelId, setLatestEpisodeUploadByChannelId] =
    useState<Record<number, string>>({});
  const [usageFilter, setUsageFilter] = useState<'all' | 'Y' | 'N'>('all');
  const [newChannels, setNewChannels] = useState<usingChannelProps[] | null>(
    null
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
  const defaultSheetName = isStaging ? 'stg_채널 DB' : '채널 DB';
  const sheetStorageKey = isStaging
    ? 'sheetName:channel:stg'
    : 'sheetName:channel:prod';
  const [selectedSheet, setSelectedSheet] = useState(
    localStorage.getItem(sheetStorageKey) || defaultSheetName
  );
  const [addData, setAddData] = useState<usingChannelProps[]>([]);

  const apiInstance = isStaging ? stgApi : api;

  const spreadsheetId = isStaging
    ? import.meta.env.VITE_STG_SPREADSHEET_ID
    : import.meta.env.VITE_SPREADSHEET_ID;

  // AbortController를 ref로 관리
  const abortControllerRef = useRef<AbortController | null>(null);
  const episodeCountLoadingRef = useRef<Set<number>>(new Set());

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

  const cancelOngoingWork = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const PAGE_SIZE = 10;

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
            `/admin/episode?page=1&size=30&channelId=${channelId}&withPlaylists=Y`
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

          setEpisodeCountByChannelId((prev) => ({
            ...prev,
            [channelId]: 0,
          }));
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

  const fetchProdPage = async (page: number, filter: 'all' | 'Y' | 'N') => {
    if (!loginToken) return;

    setProdLoading(true);

    try {
      const query =
        filter === 'all'
          ? `page=${page}&size=${PAGE_SIZE}`
          : `usageYn=${filter}&page=${page}&size=${PAGE_SIZE}`;

      const res = await apiInstance.get(`/admin/channel?${query}`);
      const { dataList, pageInfo } = res.data.data;

      setProdData(dataList);
      setProdTotalCount(pageInfo.totalCount);
      setProdTotalPages(Math.ceil(pageInfo.totalCount / PAGE_SIZE));
      await fetchEpisodeCounts(dataList);
    } catch (e) {
      console.error('채널 데이터 조회 실패:', e);
    } finally {
      setProdLoading(false);
    }
  };

  useEffect(() => {
    setProdPage(1);
    fetchProdPage(1, usageFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStaging, loginToken, usageFilter]);

  useEffect(() => {
    return () => {
      cancelOngoingWork();
    };
  }, []);

  const handleProdPageChange = (page: number) => {
    setProdPage(page);
    fetchProdPage(page, usageFilter);
  };

  const SYNC_PAGE_SIZE = 10;

  const handleSyncPageChange = (page: number) => {
    setSyncPage(page);
  };

  const handleSelectSheetDropdown = (value: string) => {
    setSelectedSheet(value);
    localStorage.setItem(sheetStorageKey, value);
  };

  const handleLoadAllChannels = async () => {
    if (!loginToken) return toast.warn('로그인을 먼저 해주세요!');
    const currentSheet = localStorage.getItem(sheetStorageKey) || selectedSheet;
    if (!currentSheet) {
      return toast.warn('시트를 먼저 선택해주세요!');
    }

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

  const handleSearchNew = async (token: string, accessToken: string) => {
    if (!loginToken) return toast.warn('로그인을 먼저 해주세요!');

    const currentSheet = localStorage.getItem(sheetStorageKey) || selectedSheet;
    if (!currentSheet) {
      return toast.warn('시트를 먼저 선택해주세요!');
    }

    try {
      setLoading(true);
      setNewChannels(null);
      setAddData([]);
      setSyncPreviewMode(null);
      setSyncPage(1);
      cancelOngoingWork();

      const newList = await getNewData(
        token,
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

    const currentSheet = localStorage.getItem(sheetStorageKey) || selectedSheet;
    if (!currentSheet) {
      return toast.warn('시트를 먼저 선택해주세요!');
    }

    if (!syncPreviewMode) {
      return toast.warn('먼저 신규 또는 전체 조회를 실행해주세요!');
    }

    const previewData =
      syncPreviewMode === 'new' ? (newChannels ?? []) : addData;

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

  return (
    <div className='p-10 flex flex-col h-[90vh]'>
      <h1 className='text-3xl font-bold mb-4 indent-1'>
        채널·도서 관리{isStaging ? ' (스테이징)' : ''}
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
                채널·도서 총{' '}
                <span className='font-extrabold'>{prodTotalCount}</span>개
              </h3>

              <div className='flex items-center gap-6'>
                <div className='flex items-center gap-3'>
                  <span className='text-sm text-gray-600 font-medium'>
                    활성화:
                  </span>

                  <label className='flex items-center gap-1.5 cursor-pointer'>
                    <input
                      type='radio'
                      name='channelUsageFilter'
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
                      name='channelUsageFilter'
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
                      name='channelUsageFilter'
                      value='N'
                      checked={usageFilter === 'N'}
                      onChange={() => setUsageFilter('N')}
                      className='accent-point-color w-4 h-4 cursor-pointer'
                    />
                    <span className='text-sm text-gray-700'>N</span>
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

        {/* 탭 2: Excel 동기화 */}
        {activeTab === 'sync' && (
          <div className='flex-1 p-8 flex flex-col min-h-0'>
            <div className='flex justify-between items-center gap-2 mb-4 flex-shrink-0'>
              <div className='flex gap-2'>
                <Button
                  onClick={() => handleSearchNew(loginToken, accessToken)}
                >
                  신규 조회
                </Button>
                <Button onClick={handleLoadAllChannels}>전체 조회</Button>
                <Button
                  href={
                    isStaging
                      ? `https://docs.google.com/spreadsheets/d/${import.meta.env.VITE_STG_SPREADSHEET_ID}/edit?gid=902383353#gid=902383353`
                      : `https://docs.google.com/spreadsheets/d/${import.meta.env.VITE_SPREADSHEET_ID}/edit?gid=934666118#gid=934666118`
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
                    <span className='font-extrabold'>{addData.length}</span>개
                  </>
                )}
                {syncPreviewMode === 'new' && (
                  <>
                    신규 동기화 대상 총{' '}
                    <span className='font-extrabold'>
                      {newChannels?.length ?? 0}
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
                새로운 채널·도서 목록을 불러오는 중입니다.
                <br />
                잠시만 기다려주세요!
              </LoadingOverlay>
              {!loading && syncPreviewMode && (
                <>
                  <div className='overflow-x-scroll episode-table-scroll pb-1 flex-1'>
                    {syncPreviewMode === 'new' && (
                      <ProdChannelList
                        data={(newChannels || []).slice(
                          (syncPage - 1) * SYNC_PAGE_SIZE,
                          syncPage * SYNC_PAGE_SIZE
                        )}
                        episodeCountByChannelId={{}}
                        latestEpisodeUploadByChannelId={{}}
                        isStaging={isStaging}
                      />
                    )}
                    {syncPreviewMode === 'all' && (
                      <ProdChannelList
                        data={addData.slice(
                          (syncPage - 1) * SYNC_PAGE_SIZE,
                          syncPage * SYNC_PAGE_SIZE
                        )}
                        episodeCountByChannelId={{}}
                        latestEpisodeUploadByChannelId={{}}
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

export default ChannelLayout;
