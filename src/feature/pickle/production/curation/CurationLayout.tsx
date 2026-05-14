import { useRef, useState } from 'react';
import { toast } from 'react-toastify';
import LoadingOverlay from '../../../../components/common/LoadingOverlay';
import Pagination from '../../../../components/common/Pagination';
import PickleLoginBanner from '../../../../components/common/PickleLoginBanner';
import TabHeader from '../../../../components/common/TabHeader';
import SheetSelector from '../../../../components/filter/SheetSelector';
import UsageFilterRadio from '../../../../components/filter/UsageFilterRadio';
import SyncCountHeader from '../../../../components/sync/SyncCountHeader';
import { SyncEmptyState } from '../../../../components/sync/SyncEmptyState';
import SyncToolbar from '../../../../components/sync/SyncToolbar';
import { useProdPagination } from '../../../../hook/useProdPagination';
import { useSheetSelection } from '../../../../hook/useSheetSelection';
import { useStagingEnv } from '../../../../hook/useStagingEnv';
import { SYNC_PAGE_SIZE, useSyncState } from '../../../../hook/useSyncState';
import { useLoginTokenStore } from '../../../../store/useLoginTokenStore';
import type {
  curationListItemProps,
  usingCurationExcelProps,
} from '../../../../types/pickleProdContents';
import { fetchAllCurationData } from '../../../../utils/api/fetchAllData';
import { appendNewCurationToExcel } from '../../../../utils/excel/appendNewCurationToExcel';
import { getNewCurationData } from '../../../../utils/excel/getNewCuration';
import { overwriteCurationExcelData } from '../../../../utils/excel/updateCuration';
import { updateSheetSyncTime } from '../../../../utils/excel/updateSheetSyncTime';
import { mapCurationStatus } from '../../../../utils/format/statusMapper';
import ProdCurationList from './ProdCurationList';

const DATA_PAGE_SIZE = 10;

type ProdCurationRow = usingCurationExcelProps & { curationId: number };

type ExhibitionFilter =
  | 'All'
  | '게시 중'
  | '게시 대기'
  | '게시 종료'
  | '게시 예약';

const EXHIBITION_OPTIONS = [
  'All',
  '게시 중',
  '게시 대기',
  '게시 종료',
  '게시 예약',
] as const;

const EXHIBITION_STATUS_MAP: Record<string, string> = {
  '게시 중': 'ACTIVE',
  '게시 대기': 'ACTIVE_NONE_DISPLAY',
  '게시 종료': 'INACTIVE',
  '게시 예약': 'WAITING',
};

const mapCurationListToRow = (
  listItem: curationListItemProps
): ProdCurationRow => ({
  curationId: listItem.curationId,
  thumbnailTitle: '',
  thumbnailUrlSquare: listItem.thumbnailUrlSquare ?? '',
  thumbnailUrlRect: listItem.thumbnailUrlRect ?? '',
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
});

const CurationLayout = () => {
  const { isStaging, apiInstance, spreadsheetId } = useStagingEnv();
  const { loginToken } = useLoginTokenStore();
  const [activeTab, setActiveTab] = useState<'data' | 'sync'>('data');

  const [exhibitionFilter, setExhibitionFilter] =
    useState<ExhibitionFilter>('All');
  const exhibitionFilterRef = useRef<ExhibitionFilter>(exhibitionFilter);
  exhibitionFilterRef.current = exhibitionFilter;

  // 동기화 탭
  const [newCurations, setNewCurations] = useState<ProdCurationRow[]>([]);
  const [allCurations, setAllCurations] = useState<ProdCurationRow[]>([]);
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

  const defaultSheetName = isStaging ? 'stg_큐레이션 DB' : '큐레이션 DB';
  const storageKey = isStaging
    ? 'sheetName:curation:stg'
    : 'sheetName:curation:prod';
  const { sheetList, selectedSheet, handleSelectSheet } = useSheetSelection({
    isStaging,
    loginToken,
    spreadsheetId,
    defaultSheetName,
    storageKey,
  });

  const {
    prodData,
    prodLoading,
    prodPage,
    prodTotalPages,
    prodTotalCount,
    prodSearchQuery,
    setProdSearchQuery,
    usageFilter,
    fetchPage,
    handleProdPageChange,
    handleSearch,
    handleUsageFilterChange,
    cancelOngoingWork,
  } = useProdPagination<ProdCurationRow>({
    fetcher: async ({ page, filter, keyword, signal }) => {
      const exhibition = exhibitionFilterRef.current;
      const params = new URLSearchParams({
        page: String(page),
        size: String(DATA_PAGE_SIZE),
        periodType: 'ALL',
      });
      if (filter !== 'All') params.set('usageYn', filter);
      if (exhibition !== 'All')
        params.set('status', EXHIBITION_STATUS_MAP[exhibition]);
      if (keyword.trim()) params.set('keyword', keyword.trim());

      const listRes = await apiInstance.get(
        `/admin/curation?${params.toString()}`,
        { signal }
      );
      const { dataList, pageInfo } = listRes.data.data as {
        dataList: curationListItemProps[];
        pageInfo: { totalCount: number };
      };

      return {
        dataList: (dataList ?? []).map(mapCurationListToRow),
        totalCount: pageInfo.totalCount ?? 0,
      };
    },
    deps: [isStaging, loginToken],
    pageSize: DATA_PAGE_SIZE,
    enabled: !!loginToken,
  });

  const handleExhibitionFilterChange = (value: ExhibitionFilter) => {
    exhibitionFilterRef.current = value;
    setExhibitionFilter(value);
    fetchPage(1, usageFilter, prodSearchQuery);
  };

  const handleLoadAllCurations = async () => {
    if (!loginToken) return toast.warn('로그인을 먼저 해주세요!');
    const currentSheet = localStorage.getItem(storageKey) || selectedSheet;
    if (!currentSheet) return toast.warn('시트를 먼저 선택해주세요!');

    try {
      setLoading(true);
      setAllCurations([]);
      setNewCurations([]);
      setSyncPreviewMode(null);
      setSyncPage(1);

      const allData = await fetchAllCurationData(apiInstance);
      setAllCurations(allData as ProdCurationRow[]);
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

  const handleSearchNew = async () => {
    if (!loginToken) return toast.warn('로그인을 먼저 해주세요!');
    const currentSheet = localStorage.getItem(storageKey) || selectedSheet;
    if (!currentSheet) return toast.warn('시트를 먼저 선택해주세요!');

    try {
      setLoading(true);
      setNewCurations([]);
      setAllCurations([]);
      setSyncPreviewMode(null);
      setSyncPage(1);
      cancelOngoingWork();

      const newList = await getNewCurationData(
        loginToken,
        setProgress,
        apiInstance,
        spreadsheetId,
        currentSheet
      );
      setNewCurations(newList as ProdCurationRow[]);
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
    const currentSheet = localStorage.getItem(storageKey) || selectedSheet;
    if (!currentSheet) return toast.warn('시트를 먼저 선택해주세요!');
    if (!syncPreviewMode)
      return toast.warn('먼저 신규 또는 전체 조회를 실행해주세요!');

    const previewData = syncPreviewMode === 'new' ? newCurations : allCurations;

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

  const excelHref = isStaging
    ? `https://docs.google.com/spreadsheets/d/${import.meta.env.VITE_STG_SPREADSHEET_ID}/edit?gid=1243772316#gid=1243772316`
    : `https://docs.google.com/spreadsheets/d/${import.meta.env.VITE_SPREADSHEET_ID}/edit?gid=991347809#gid=991347809`;

  const syncDisplayData =
    syncPreviewMode === 'new' ? newCurations : allCurations;

  return (
    <div className='flex flex-col h-[90vh]'>
      <PickleLoginBanner
        serverId={isStaging ? 'stg' : 'prod'}
        serverLabel={isStaging ? 'STG' : '상용'}
      />
      <div className='p-10 flex flex-col h-full'>
        <h1 className='text-3xl font-bold mb-4 indent-1'>
          큐레이션 관리{isStaging ? ' (스테이징)' : ''}
        </h1>
        <div className='w-full rounded-2xl bg-white mt-4 flex flex-col'>
          <TabHeader activeTab={activeTab} onChange={setActiveTab} />

          {activeTab === 'data' && (
            <div className='flex-1 p-8 flex flex-col'>
              <div className='flex justify-between items-center flex-shrink-0 mb-4'>
                <h3 className='text-point-color font-semibold'>
                  큐레이션 총{' '}
                  <span className='font-extrabold'>{prodTotalCount}</span>개
                </h3>
                <div className='flex gap-6 items-center'>
                  <UsageFilterRadio
                    name='usageFilter'
                    value={usageFilter}
                    onChange={handleUsageFilterChange}
                  />
                  <UsageFilterRadio
                    name='exhibitionFilter'
                    label='전시 상태'
                    options={EXHIBITION_OPTIONS}
                    value={exhibitionFilter}
                    onChange={handleExhibitionFilterChange}
                  />
                  <input
                    type='text'
                    value={prodSearchQuery}
                    onChange={(e) => setProdSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder='큐레이션명 검색'
                    className='border border-gray-300 px-4 py-2 rounded-lg text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition w-60'
                  />
                  <button
                    onClick={handleSearch}
                    className='cursor-pointer'
                    disabled={prodLoading}
                  >
                    <img
                      src='/redo.svg'
                      alt='새로고침'
                      width={22}
                      height={22}
                    />
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

          {activeTab === 'sync' && (
            <div className='flex-1 p-8 flex flex-col min-h-0'>
              <SyncToolbar
                onSearchNew={handleSearchNew}
                onLoadAll={handleLoadAllCurations}
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
                  newCount={newCurations.length}
                  allCount={allCurations.length}
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
                  큐레이션 목록을 불러오는 중입니다.
                  <br />
                  잠시만 기다려주세요!
                </LoadingOverlay>
                {!loading && syncPreviewMode && (
                  <>
                    <div className='overflow-x-scroll episode-table-scroll pb-1 flex-1'>
                      <ProdCurationList
                        data={syncDisplayData.slice(
                          (syncPage - 1) * SYNC_PAGE_SIZE,
                          syncPage * SYNC_PAGE_SIZE
                        )}
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

export default CurationLayout;
