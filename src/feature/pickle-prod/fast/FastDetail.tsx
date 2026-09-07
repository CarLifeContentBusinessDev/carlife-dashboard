import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { GREEN_BADGE_STYLE, RED_BADGE_STYLE } from '@/constants/badgeStyles';
import Pagination from '@/shared/components/common/Pagination';
import type {
  fastContentItemProps,
  fastDetailProps,
  fastStatsProps,
  ProdFastRow,
} from '@/shared/types/pickleProdContents';
import { api, stgApi } from '@/shared/utils/api/api';
import formatDateString from '@/shared/utils/format/formatDateString';
import { formatPlayTime } from '@/shared/utils/format/formatPlayTime';
import { mapFastHlsStatus } from '@/shared/utils/format/statusMapper';
import { normalizeUsageYn } from '@/shared/utils/format/normalizeUsageYn';

const EPISODE_PAGE_SIZE = 10;

type FastSummaryState = ProdFastRow;

const isImageUrl = (url: string) =>
  /\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i.test(url) ||
  url.toLowerCase().includes('thumbnail');

type FieldValue = string | number | undefined | null;

interface FieldDef {
  label: string;
  value: FieldValue;
  wide?: boolean;
  type?: 'text' | 'date' | 'usage' | 'image' | 'duration';
}

const renderFieldValue = (field: FieldDef): React.ReactNode => {
  const { value, type = 'text' } = field;

  if (type === 'usage') {
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

  if (type === 'date') return formatDateString(String(value ?? '')) || '-';

  if (type === 'duration') {
    const seconds = Number(value ?? 0);
    return seconds > 0 ? formatPlayTime(seconds) : '-';
  }

  if (type === 'image') {
    const url = String(value ?? '');
    return isImageUrl(url) ? (
      <img
        src={url}
        alt='썸네일'
        className='w-44 h-44 rounded-xl object-cover border border-gray-200 bg-gray-50'
      />
    ) : (
      <div className='w-44 h-44 flex items-center justify-center text-gray-400'>
        이미지 없음
      </div>
    );
  }

  return String(value ?? '-') || '-';
};

const EPISODE_COLUMNS: Array<{
  key: keyof fastContentItemProps;
  label: string;
  width: string;
  render?: (episode: fastContentItemProps) => React.ReactNode;
}> = [
  { key: 'channelId', label: '채널 ID', width: 'w-[100px]' },
  { key: 'episodeId', label: '에피소드 ID', width: 'w-[110px]' },
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
    key: 'playTime',
    label: '재생 시간',
    width: 'w-[120px]',
    render: (ep) => formatPlayTime(ep.playTime ?? 0),
  },
  { key: 'likeCnt', label: '좋아요수', width: 'w-[90px]' },
  { key: 'listenCnt', label: '청취수', width: 'w-[90px]' },
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
];

const FastDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const fastState = (location.state as { fast?: FastSummaryState })?.fast;
  const from = (location.state as { from?: string })?.from ?? '/pickle/fast';
  const isStaging = location.pathname.includes('/stg/');

  const [detail, setDetail] = useState<fastDetailProps | null>(null);
  const [stats, setStats] = useState<fastStatsProps | null>(null);
  const [loading, setLoading] = useState(false);
  const [episodePage, setEpisodePage] = useState(1);

  const fastId = Number(id);

  useEffect(() => {
    if (!id || Number.isNaN(fastId)) return;

    const instance = isStaging ? stgApi : api;
    const controller = new AbortController();
    setLoading(true);

    Promise.allSettled([
      instance.get(`/admin/fast/${fastId}`, { signal: controller.signal }),
      instance.get(`/admin/fast/${fastId}/stats`, {
        signal: controller.signal,
      }),
    ])
      .then(([detailRes, statsRes]) => {
        if (controller.signal.aborted) return;
        setDetail(
          detailRes.status === 'fulfilled'
            ? (detailRes.value.data?.data ?? null)
            : null
        );
        setStats(
          statsRes.status === 'fulfilled'
            ? (statsRes.value.data?.data ?? null)
            : null
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [id, fastId, isStaging]);

  const hls = detail?.hlsStatus;
  const allEpisodes: fastContentItemProps[] = detail?.contentList ?? [];
  const episodeTotalCount = detail?.contentTotalCount ?? allEpisodes.length;
  const episodeTotalPages = Math.max(
    1,
    Math.ceil(allEpisodes.length / EPISODE_PAGE_SIZE)
  );
  const pagedEpisodes = allEpisodes.slice(
    (episodePage - 1) * EPISODE_PAGE_SIZE,
    episodePage * EPISODE_PAGE_SIZE
  );

  const wideFields: FieldDef[] = [
    {
      label: 'FAST 명',
      value: detail?.fastName ?? fastState?.fastName ?? '-',
      wide: true,
    },
    { label: 'FAST 설명', value: detail?.fastDesc ?? '-', wide: true },
  ];

  const narrowFields: FieldDef[] = [
    {
      label: 'thumbnail (AAOS)',
      value: detail?.thumbnailUrlAaos ?? '',
      type: 'image',
    },
    {
      label: 'thumbnail (AOSP)',
      value: detail?.thumbnailUrlAos ?? '',
      type: 'image',
    },
    {
      label: '활성화',
      value: detail?.usageYn ?? fastState?.usageYn,
      type: 'usage',
    },
    {
      label: '생성 상태',
      value: mapFastHlsStatus(hls?.status ?? fastState?.hlsStatus ?? '') || '-',
    },
    { label: '콘텐츠 타입', value: detail?.contentType ?? '-' },
    {
      label: '에피소드 수',
      value: detail?.episodeCount ?? fastState?.episodeCount ?? '-',
    },
    {
      label: '총 재생 시간',
      value: detail?.totalPlayTime,
      type: 'duration',
    },
    {
      label: '등록 일시',
      value: detail?.createdAt ?? fastState?.createdAt,
      type: 'date',
    },
    {
      label: '게시 시작일',
      value: detail?.dispStartDtime ?? fastState?.dispStartDtime,
      type: 'date',
    },
    {
      label: '게시 종료일',
      value: detail?.dispEndDtime ?? fastState?.dispEndDtime,
      type: 'date',
    },
    {
      label: '생성 시작 시간',
      value: hls?.generationStartedAt ?? fastState?.generationStartedAt,
      type: 'date',
    },
    {
      label: '생성 종료 시간',
      value: hls?.generationEndedAt ?? fastState?.generationEndedAt,
      type: 'date',
    },
    {
      label: '총 생성 시간',
      value: hls?.elapsedSeconds ?? fastState?.totalGenerationSeconds,
      type: 'duration',
    },
    {
      label: '재생 요청 수',
      value: stats?.playRequestCount ?? fastState?.playRequestCount ?? 0,
    },
    { label: '터치 수', value: stats?.touchCount ?? 0 },
    { label: '게시자', value: detail?.creatorName ?? '-' },
    { label: 'streamUrl', value: detail?.streamUrl ?? fastState?.streamUrl ?? '-' },
    { label: 'previewStreamUrl', value: detail?.previewStreamUrl ?? '-' },
  ];

  return (
    <div className='p-10 flex flex-col'>
      <h1 className='mb-4 indent-1' style={{ fontSize: '16px' }}>
        <span className='text-gray-500'>FAST 관리 / </span>
        <span className='font-bold'>FAST 상세</span>
      </h1>

      <div className='w-full rounded-2xl bg-white mt-4 p-8 flex flex-col gap-6 shadow-sm border border-gray-100'>
        <div className='flex items-center justify-between border-b border-gray-100 pb-4'>
          <div>
            <h2 className='text-lg font-semibold'>FAST 정보</h2>
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
                key={field.label}
                className='grid grid-cols-[170px_1fr] rounded-xl border border-gray-100 overflow-hidden'
              >
                <div className='px-4 py-3 bg-gray-50 font-semibold text-sm text-gray-600'>
                  {field.label}
                </div>
                <div className='px-4 py-3 text-sm bg-white break-all'>
                  {renderFieldValue(field)}
                </div>
              </div>
            ))}

            <div className='grid grid-cols-1 lg:grid-cols-2 gap-3'>
              {narrowFields.map((field) => (
                <div
                  key={field.label}
                  className='grid grid-cols-[170px_1fr] rounded-xl border border-gray-100 overflow-hidden'
                >
                  <div className='px-4 py-3 bg-gray-50 font-semibold text-sm text-gray-600'>
                    {field.label}
                  </div>
                  <div className='px-4 py-3 text-sm bg-white break-all'>
                    {renderFieldValue(field)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className='pt-10 border-t border-gray-100'>
          <div className='flex items-center justify-between mb-3'>
            <h3 className='font-semibold'>포함된 에피소드</h3>
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
                      className={`px-2 ${col.width} shrink-0 text-sm`}
                    >
                      {col.label}
                    </p>
                  ))}
                </div>

                {pagedEpisodes.map((episode, index) => (
                  <div
                    key={`${episode.episodeId ?? 0}-${index}`}
                    className='flex items-center border-b border-gray-200 py-3 hover:bg-gray-50 cursor-pointer'
                    onClick={() =>
                      navigate(
                        isStaging
                          ? `/pickle/stg/episodes/detail/${episode.episodeId}`
                          : `/pickle/episodes/detail/${episode.episodeId}`
                      )
                    }
                  >
                    {EPISODE_COLUMNS.map((col) => (
                      <div
                        key={col.key}
                        className={`px-2 ${col.width} shrink-0 text-sm truncate`}
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

export default FastDetail;
