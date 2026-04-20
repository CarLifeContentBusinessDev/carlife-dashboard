import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import Pagination from '../../components/Pagination';
import type {
  curationDetailEpisodeProps,
  curationDetailProps,
  usingCurationExcelProps,
} from '../../types/type';
import formatDateString from '../../utils/formatDateString';
import { api, stgApi } from '../../utils/api';
import { mapCurationStatus } from '../../utils/statusMapper';

const EPISODE_PAGE_SIZE = 10;

type CurationSummaryState = usingCurationExcelProps & {
  curationId: number;
};

const normalizeUsageYn = (value: unknown): 'Y' | 'N' | '' => {
  const normalized = String(value ?? '')
    .trim()
    .toUpperCase();

  if (['Y', 'YES', 'TRUE', '1', 'ACTIVE'].includes(normalized)) return 'Y';
  if (['N', 'NO', 'FALSE', '0', 'INACTIVE'].includes(normalized)) return 'N';

  return '';
};

const renderUsageBadge = (value: unknown) => {
  const usage = normalizeUsageYn(value);

  return (
    <span
      className={`px-2 py-0.5 rounded text-xs font-bold ${
        usage === 'Y'
          ? 'bg-green-100 text-green-700'
          : 'bg-red-100 text-red-700'
      }`}
    >
      {usage || '-'}
    </span>
  );
};

const ProdCurationDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const curationState = (
    location.state as { curation?: CurationSummaryState; from?: string }
  )?.curation;
  const from = (location.state as { from?: string })?.from ?? '/curation-list';
  const isStaging = location.pathname.startsWith('/stg');

  const apiInstance = isStaging ? stgApi : api;

  const [detail, setDetail] = useState<curationDetailProps | null>(null);
  const [loading, setLoading] = useState(false);
  const [episodePage, setEpisodePage] = useState(1);

  const curationId = Number(id);

  const fetchDetail = async () => {
    if (!id || Number.isNaN(curationId)) return;

    setLoading(true);
    try {
      const res = await apiInstance.get(`/admin/curation/${curationId}`);
      setDetail(res.data?.data ?? null);
    } catch (error) {
      console.error('큐레이션 상세 조회 실패:', error);
      setDetail(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isStaging]);

  const allEpisodes: curationDetailEpisodeProps[] = detail?.episodes ?? [];
  const episodeTotalCount = allEpisodes.length;
  const episodeTotalPages = Math.max(
    1,
    Math.ceil(episodeTotalCount / EPISODE_PAGE_SIZE)
  );

  const pagedEpisodes = allEpisodes.slice(
    (episodePage - 1) * EPISODE_PAGE_SIZE,
    episodePage * EPISODE_PAGE_SIZE
  );

  const handlePageChange = (page: number) => {
    setEpisodePage(page);
  };

  const topInfo = {
    curationType: detail?.curationType ?? curationState?.curationType ?? '-',
    curationName: detail?.curationName ?? curationState?.curationName ?? '-',
    curationDesc: detail?.curationDesc ?? curationState?.curationDesc ?? '-',
    activeState: detail?.usageYn ?? curationState?.activeState ?? '-',
    exhibitionState:
      mapCurationStatus(detail?.status ?? '') ||
      curationState?.exhibitionState ||
      '-',
    field: detail?.field ?? curationState?.field ?? '-',
    section: detail?.section ?? curationState?.section ?? '-',
    dispStartDtime:
      detail?.dispStartDtime ?? curationState?.dispStartDtime ?? '-',
    dispEndDtime: detail?.dispEndDtime ?? curationState?.dispEndDtime ?? '-',
    createdAt: detail?.createdAt ?? curationState?.curationCreatedAt ?? '-',
    creatorName: detail?.creatorName ?? curationState?.uploader ?? '-',
  };

  return (
    <div className='p-10 flex flex-col'>
      <h1 className='mb-4 indent-1' style={{ fontSize: '16px' }}>
        <span className='text-gray-500'>큐레이션 관리 / </span>
        <span className='font-bold'>큐레이션 상세</span>
      </h1>

      <div className='w-full rounded-2xl bg-white mt-4 p-8 flex flex-col gap-6 shadow-sm border border-gray-100'>
        <div className='flex items-center justify-between border-b border-gray-100 pb-4'>
          <div>
            <h2 className='text-lg font-semibold'>큐레이션 정보</h2>
            <p className='text-sm text-gray-400 mt-1'>ID: {id}</p>
          </div>
          <button
            onClick={() => navigate(from)}
            className='px-3 py-2 rounded bg-gray-100 text-gray-700 hover:bg-gray-200 transition text-sm'
          >
            목록
          </button>
        </div>

        {loading ? (
          <div className='py-6 text-center text-gray-500'>
            상세 정보를 불러오는 중입니다.
          </div>
        ) : (
          <div className='grid grid-cols-1 lg:grid-cols-2 gap-3'>
            <div className='grid grid-cols-[170px_1fr] rounded-xl border border-gray-100 overflow-hidden'>
              <div className='px-4 py-3 bg-gray-50 font-semibold text-sm text-gray-600'>
                타입
              </div>
              <div className='px-4 py-3 text-sm bg-white'>
                {topInfo.curationType}
              </div>
            </div>

            <div className='grid grid-cols-[170px_1fr] rounded-xl border border-gray-100 overflow-hidden'>
              <div className='px-4 py-3 bg-gray-50 font-semibold text-sm text-gray-600'>
                큐레이션명
              </div>
              <div className='px-4 py-3 text-sm bg-white'>
                {topInfo.curationName}
              </div>
            </div>

            <div className='grid grid-cols-[170px_1fr] rounded-xl border border-gray-100 overflow-hidden lg:col-span-2'>
              <div className='px-4 py-3 bg-gray-50 font-semibold text-sm text-gray-600'>
                큐레이션 설명
              </div>
              <div className='px-4 py-3 text-sm bg-white break-all'>
                {topInfo.curationDesc}
              </div>
            </div>

            <div className='grid grid-cols-[170px_1fr] rounded-xl border border-gray-100 overflow-hidden'>
              <div className='px-4 py-3 bg-gray-50 font-semibold text-sm text-gray-600'>
                활성 상태
              </div>
              <div className='px-4 py-3 text-sm bg-white'>
                {renderUsageBadge(topInfo.activeState)}
              </div>
            </div>

            <div className='grid grid-cols-[170px_1fr] rounded-xl border border-gray-100 overflow-hidden'>
              <div className='px-4 py-3 bg-gray-50 font-semibold text-sm text-gray-600'>
                전시 상태
              </div>
              <div className='px-4 py-3 text-sm bg-white'>
                {topInfo.exhibitionState}
              </div>
            </div>

            <div className='grid grid-cols-[170px_1fr] rounded-xl border border-gray-100 overflow-hidden'>
              <div className='px-4 py-3 bg-gray-50 font-semibold text-sm text-gray-600'>
                영역
              </div>
              <div className='px-4 py-3 text-sm bg-white'>
                {String(topInfo.field)}
              </div>
            </div>

            <div className='grid grid-cols-[170px_1fr] rounded-xl border border-gray-100 overflow-hidden'>
              <div className='px-4 py-3 bg-gray-50 font-semibold text-sm text-gray-600'>
                상세위치
              </div>
              <div className='px-4 py-3 text-sm bg-white'>
                {String(topInfo.section)}
              </div>
            </div>

            <div className='grid grid-cols-[170px_1fr] rounded-xl border border-gray-100 overflow-hidden'>
              <div className='px-4 py-3 bg-gray-50 font-semibold text-sm text-gray-600'>
                게시 시작일
              </div>
              <div className='px-4 py-3 text-sm bg-white'>
                {formatDateString(String(topInfo.dispStartDtime))}
              </div>
            </div>

            <div className='grid grid-cols-[170px_1fr] rounded-xl border border-gray-100 overflow-hidden'>
              <div className='px-4 py-3 bg-gray-50 font-semibold text-sm text-gray-600'>
                게시 종료일
              </div>
              <div className='px-4 py-3 text-sm bg-white'>
                {formatDateString(String(topInfo.dispEndDtime))}
              </div>
            </div>

            <div className='grid grid-cols-[170px_1fr] rounded-xl border border-gray-100 overflow-hidden'>
              <div className='px-4 py-3 bg-gray-50 font-semibold text-sm text-gray-600'>
                등록일시
              </div>
              <div className='px-4 py-3 text-sm bg-white'>
                {formatDateString(String(topInfo.createdAt))}
              </div>
            </div>

            <div className='grid grid-cols-[170px_1fr] rounded-xl border border-gray-100 overflow-hidden'>
              <div className='px-4 py-3 bg-gray-50 font-semibold text-sm text-gray-600'>
                게시자
              </div>
              <div className='px-4 py-3 text-sm bg-white'>
                {String(topInfo.creatorName)}
              </div>
            </div>
          </div>
        )}

        <div className='pt-10 border-t border-gray-100'>
          <div className='flex items-center justify-between mb-3'>
            <h3 className='font-semibold'>등록된 에피소드</h3>
            <span className='text-base font-bold text-gray-500'>
              총 {episodeTotalCount}개
            </span>
          </div>

          {pagedEpisodes.length === 0 ? (
            <div className='py-8 text-center text-gray-400'>
              표시할 에피소드가 없습니다.
            </div>
          ) : (
            <div className='overflow-x-scroll episode-table-scroll pb-1'>
              <div style={{ minWidth: '1200px', width: '100%' }}>
                <div className='flex font-bold py-3 bg-white border-b-2 border-gray-300'>
                  <p className='px-2 w-[90px] flex-shrink-0 text-sm'>채널 ID</p>
                  <p className='px-2 w-[100px] flex-shrink-0 text-sm'>
                    에피소드 ID
                  </p>
                  <p className='px-2 w-[90px] flex-shrink-0 text-sm'>상태</p>
                  <p className='px-2 w-[170px] flex-shrink-0 text-sm'>채널명</p>
                  <p className='px-2 w-[260px] flex-shrink-0 text-sm'>
                    에피소드명
                  </p>
                  <p className='px-2 w-[160px] flex-shrink-0 text-sm'>
                    게시일자
                  </p>
                  <p className='px-2 w-[160px] flex-shrink-0 text-sm'>
                    등록일자
                  </p>
                  <p className='px-2 w-[120px] flex-shrink-0 text-sm'>
                    에피소드 시간
                  </p>
                  <p className='px-2 w-[90px] flex-shrink-0 text-sm'>
                    좋아요수
                  </p>
                  <p className='px-2 w-[90px] flex-shrink-0 text-sm'>청취수</p>
                </div>

                {pagedEpisodes.map((episode, index) => (
                  <div
                    key={`${episode.episodeId ?? 0}-${index}`}
                    className='flex items-center border-b border-gray-200 py-3'
                  >
                    <div className='px-2 w-[90px] flex-shrink-0 text-sm truncate'>
                      {String(episode.channelId ?? '')}
                    </div>
                    <div className='px-2 w-[100px] flex-shrink-0 text-sm truncate'>
                      {String(episode.episodeId ?? '')}
                    </div>
                    <div className='px-2 w-[90px] flex-shrink-0 text-sm truncate'>
                      {renderUsageBadge(episode.usageYn)}
                    </div>
                    <div className='px-2 w-[170px] flex-shrink-0 text-sm truncate'>
                      {String(episode.channelName ?? '')}
                    </div>
                    <div className='px-2 w-[260px] flex-shrink-0 text-sm truncate'>
                      {String(episode.episodeName ?? '')}
                    </div>
                    <div className='px-2 w-[160px] flex-shrink-0 text-sm truncate'>
                      {formatDateString(String(episode.dispDtime ?? ''))}
                    </div>
                    <div className='px-2 w-[160px] flex-shrink-0 text-sm truncate'>
                      {formatDateString(String(episode.createdAt ?? ''))}
                    </div>
                    <div className='px-2 w-[120px] flex-shrink-0 text-sm truncate'>
                      {String(episode.playTime ?? '')}
                    </div>
                    <div className='px-2 w-[90px] flex-shrink-0 text-sm truncate'>
                      {String(episode.likeCnt ?? '')}
                    </div>
                    <div className='px-2 w-[90px] flex-shrink-0 text-sm truncate'>
                      {String(episode.listenCnt ?? '')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Pagination
            page={episodePage}
            totalPages={episodeTotalPages}
            onChange={handlePageChange}
          />
        </div>
      </div>
    </div>
  );
};

export default ProdCurationDetail;
