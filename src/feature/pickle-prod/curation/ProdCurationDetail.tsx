import { GREEN_BADGE_STYLE, RED_BADGE_STYLE } from '@/constants/badgeStyles';
import Pagination from '@/shared/components/common/Pagination';
import type {
  curationDetailEpisodeProps,
  curationDetailProps,
  usingCurationExcelProps,
} from '@/shared/types/pickleProdContents';
import { api, stgApi } from '@/shared/utils/api/api';
import formatDateString from '@/shared/utils/format/formatDateString';
import { normalizeUsageYn } from '@/shared/utils/format/normalizeUsageYn';
import { mapCurationStatus } from '@/shared/utils/format/statusMapper';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

const EPISODE_PAGE_SIZE = 10;

type CurationSummaryState = usingCurationExcelProps & { curationId: number };

type TopInfo = {
  thumbnailUrlSquare: string;
  curationType: string;
  curationName: string;
  curationDesc: string;
  activeState: unknown;
  exhibitionState: string;
  field: unknown;
  section: unknown;
  dispStartDtime: string;
  dispEndDtime: string;
  createdAt: string;
  creatorName: unknown;
};

type CurationFieldDef = {
  key: keyof TopInfo;
  label: string;
  wide?: boolean;
};

const CURATION_FIELD_DEFS: CurationFieldDef[] = [
  { key: 'curationName', label: '큐레이션명', wide: true },
  { key: 'curationDesc', label: '큐레이션 설명', wide: true },
  { key: 'thumbnailUrlSquare', label: '썸네일' },
  { key: 'curationType', label: '타입' },
  { key: 'activeState', label: '활성 상태' },
  { key: 'exhibitionState', label: '전시 상태' },
  { key: 'field', label: '영역' },
  { key: 'section', label: '상세위치' },
  { key: 'createdAt', label: '등록일시' },
  { key: 'dispStartDtime', label: '게시 시작일' },
  { key: 'dispEndDtime', label: '게시 종료일' },
  { key: 'creatorName', label: '게시자' },
];

type EpisodeColumnDef = {
  key: keyof curationDetailEpisodeProps;
  label: string;
  width: string;
  render?: (episode: curationDetailEpisodeProps) => React.ReactNode;
};

const EPISODE_COLUMNS: EpisodeColumnDef[] = [
  { key: 'channelId', label: '채널 ID', width: 'w-[100px]' },
  { key: 'episodeId', label: '에피소드 ID', width: 'w-[100px]' },
  {
    key: 'usageYn',
    label: '상태',
    width: 'w-[80px]',
    render: (ep) => {
      const usage = normalizeUsageYn(ep.usageYn);
      return (
        <span
          className={`px-2 py-0.5 rounded text-xs font-bold ${
            usage === 'Y' ? GREEN_BADGE_STYLE : RED_BADGE_STYLE
          }`}
        >
          {usage || '-'}
        </span>
      );
    },
  },
  { key: 'channelName', label: '채널명', width: 'w-[220px]' },
  { key: 'episodeName', label: '에피소드명', width: 'w-[360px]' },
  {
    key: 'dispDtime',
    label: '게시일자',
    width: 'w-[180px]',
    render: (ep) => formatDateString(String(ep.dispDtime ?? '')),
  },
  {
    key: 'createdAt',
    label: '등록일자',
    width: 'w-[180px]',
    render: (ep) => formatDateString(String(ep.createdAt ?? '')),
  },
  { key: 'playTime', label: '에피소드 시간', width: 'w-[120px]' },
  { key: 'likeCnt', label: '좋아요수', width: 'w-[90px]' },
  { key: 'listenCnt', label: '청취수', width: 'w-[90px]' },
];

const isImageUrl = (url: string) =>
  /\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i.test(url) ||
  url.toLowerCase().includes('thumbnail');

const renderCurationValue = (
  key: keyof TopInfo,
  value: unknown
): React.ReactNode => {
  if (key === 'activeState') {
    const usage = normalizeUsageYn(value);
    return (
      <span
        className={`px-2 py-0.5 rounded text-xs font-bold ${
          usage === 'Y' ? GREEN_BADGE_STYLE : RED_BADGE_STYLE
        }`}
      >
        {usage || '-'}
      </span>
    );
  }

  if (
    key === 'dispStartDtime' ||
    key === 'dispEndDtime' ||
    key === 'createdAt'
  ) {
    return formatDateString(String(value));
  }

  if (key === 'thumbnailUrlSquare') {
    return isImageUrl(String(value)) ? (
      <img
        src={String(value)}
        alt='썸네일'
        className='w-44 h-44 rounded-xl object-cover border border-gray-200 bg-gray-50 overflow-hidden flex items-center justify-center'
      />
    ) : (
      <div className='w-44 h-44 flex items-center justify-center text-gray-400'>
        이미지 없음
      </div>
    );
  }

  return String(value ?? '-');
};

const ProdCurationDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const curationState = (
    location.state as { curation?: CurationSummaryState; from?: string }
  )?.curation;
  const from = (location.state as { from?: string })?.from ?? '/curation-list';
  const isStaging = location.pathname.includes('/stg/');

  const [detail, setDetail] = useState<curationDetailProps | null>(null);
  const [loading, setLoading] = useState(false);
  const [episodePage, setEpisodePage] = useState(1);

  const curationId = Number(id);

  useEffect(() => {
    if (!id || Number.isNaN(curationId)) return;

    const instance = isStaging ? stgApi : api;
    const controller = new AbortController();
    setLoading(true);
    instance
      .get(`/admin/curation/${curationId}`, {
        signal: controller.signal,
      })
      .then((res) => {
        if (!controller.signal.aborted) {
          setDetail(res.data?.data ?? null);
        }
      })
      .catch((error) => {
        if (
          error.name !== 'CanceledError' &&
          error.name !== 'AbortError' &&
          !controller.signal.aborted
        ) {
          console.error('큐레이션 상세 조회 실패:', error);
          setDetail(null);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [id, curationId, isStaging]);

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

  const topInfo: TopInfo = {
    thumbnailUrlSquare:
      detail?.thumbnailUrlSquare ?? detail?.thumbnailUrlRect ?? '',
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

  const wideFields = CURATION_FIELD_DEFS.filter((f) => f.wide);
  const narrowFields = CURATION_FIELD_DEFS.filter((f) => !f.wide);

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
          <div className='grid grid-cols-1 gap-3'>
            {wideFields.map((field) => (
              <div
                key={field.key}
                className='grid grid-cols-[170px_1fr] rounded-xl border border-gray-100 overflow-hidden'
              >
                <div className='px-4 py-3 bg-gray-50 font-semibold text-sm text-gray-600'>
                  {field.label}
                </div>
                <div className='px-4 py-3 text-sm bg-white break-all'>
                  {renderCurationValue(field.key, topInfo[field.key])}
                </div>
              </div>
            ))}

            <div className='grid grid-cols-1 lg:grid-cols-2 gap-3'>
              {narrowFields.map((field) => {
                const isThumbnailField = field.key === 'thumbnailUrlSquare';
                return (
                  <div
                    key={field.key}
                    className={`grid grid-cols-[170px_1fr] rounded-xl border border-gray-100 overflow-hidden ${
                      isThumbnailField ? 'lg:row-span-4' : ''
                    }`}
                  >
                    <div
                      className={`px-4 bg-gray-50 font-semibold text-sm text-gray-600 ${
                        isThumbnailField ? 'py-4' : 'py-3'
                      }`}
                    >
                      {field.label}
                    </div>
                    <div
                      className={`px-4 text-sm bg-white break-all ${
                        isThumbnailField
                          ? 'py-4 min-h-[180px] flex items-start'
                          : 'py-3'
                      }`}
                    >
                      {renderCurationValue(field.key, topInfo[field.key])}
                    </div>
                  </div>
                );
              })}
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
                  {EPISODE_COLUMNS.map((col) => (
                    <p
                      key={col.key}
                      className={`px-2 ${col.width} flex-shrink-0 text-sm`}
                    >
                      {col.label}
                    </p>
                  ))}
                </div>

                {pagedEpisodes.map((episode, index) => (
                  <div
                    key={`${episode.episodeId ?? 0}-${index}`}
                    className={`flex items-center border-b border-gray-200 py-3 hover:bg-gray-50 cursor-pointer `}
                    onClick={() =>
                      isStaging
                        ? navigate(`/pickle/stg/episodes/detail/${episode.episodeId}`)
                        : navigate(`/pickle/episodes/detail/${episode.episodeId}`)
                    }
                  >
                    {EPISODE_COLUMNS.map((col) => (
                      <div
                        key={col.key}
                        className={`px-2 ${col.width} flex-shrink-0 text-sm truncate`}
                      >
                        {col.render
                          ? col.render(episode)
                          : String(episode[col.key] ?? '')}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          <Pagination
            page={episodePage}
            totalPages={episodeTotalPages}
            onChange={setEpisodePage}
          />
        </div>
      </div>
    </div>
  );
};

export default ProdCurationDetail;
