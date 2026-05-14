import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import Pagination from '../../../../components/common/Pagination';
import type {
  usingChannelProps,
  usingDataProps,
} from '../../../../types/pickleProdContents';
import { api, stgApi } from '../../../../utils/api/api';
import formatDateString from '../../../../utils/format/formatDateString';
import { normalizeUsageYn } from '../../../../utils/format/normalizeUsageYn';

const EPISODE_PAGE_SIZE = 10;

const CHANNEL_FIELD_DEFS: Array<{
  key: keyof usingChannelProps;
  label: string;
}> = [
  { key: 'thumbnailUrl', label: '썸네일' },
  { key: 'channelName', label: '채널명' },
  { key: 'vendorName', label: '제작사명' },
  { key: 'usageYn', label: '활성 상태' },
  { key: 'categoryName', label: '카테고리' },
  { key: 'channelTypeName', label: '채널 타입' },
  { key: 'createdAt', label: '등록일' },
  { key: 'likeCnt', label: '좋아요수' },
  { key: 'listenCnt', label: '재생 요청 수' },
  { key: 'dispDtime', label: '최근 에피소드 업로드일' },
  { key: 'interfaceUrl', label: 'RSS URL' },
];

interface EpisodeColumn {
  key: keyof usingDataProps;
  label: string;
  width?: string;
  minWidth?: string;
  isFlex?: boolean;
}

const EPISODE_COLUMNS: EpisodeColumn[] = [
  { key: 'episodeId', label: '에피소드 ID', width: '90px' },
  { key: 'usageYn', label: '활성 상태', width: '70px' },
  { key: 'episodeName', label: '에피소드명', minWidth: '280px', isFlex: true },
  { key: 'dispDtime', label: '게시일자', width: '180px' },
  { key: 'createdAt', label: '등록일자', width: '180px' },
  { key: 'playTime', label: '재생 시간(초)', width: '100px' },
  { key: 'likeCnt', label: '좋아요수', width: '80px' },
  { key: 'listenCnt', label: '청취수', width: '80px' },
];

const isImageUrl = (url: string) =>
  /\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i.test(url) ||
  url.toLowerCase().includes('thumbnail');

const formatFieldValue = (
  key: keyof usingChannelProps,
  value: string | number
): React.ReactNode => {
  if (key === 'dispDtime' || key === 'createdAt') {
    return formatDateString(String(value));
  }

  if (key === 'usageYn') {
    const usageYn = normalizeUsageYn(value);

    return (
      <span
        className={`px-2 py-0.5 rounded text-xs font-bold ${
          usageYn === 'Y'
            ? 'bg-green-100 text-green-700'
            : 'bg-red-100 text-red-700'
        }`}
      >
        {usageYn || '-'}
      </span>
    );
  }

  if (key === 'thumbnailUrl' && typeof value === 'string' && value) {
    return (
      <div className='flex flex-col gap-2'>
        {isImageUrl(value) && (
          <div className='w-44 h-44 rounded-xl border border-gray-200 bg-gray-50 overflow-hidden flex items-center justify-center'>
            <img
              src={value}
              alt='thumbnail'
              className='w-full h-full object-cover'
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
        )}
      </div>
    );
  }

  if (
    (key === 'interfaceUrl' || key === 'thumbnailUrl') &&
    typeof value === 'string' &&
    value.startsWith('http')
  ) {
    return (
      <a
        href={value}
        target='_blank'
        rel='noopener noreferrer'
        className='text-blue-500 text-sm underline break-all'
      >
        {value}
      </a>
    );
  }

  return String(value ?? '-');
};

const formatEpisodeValue = (
  episode: usingDataProps,
  key: EpisodeColumn['key']
): React.ReactNode => {
  if (key === 'usageYn') {
    const usageYn = normalizeUsageYn(episode[key]);

    return (
      <span
        className={`px-2 py-0.5 rounded text-xs font-bold ${
          usageYn === 'Y'
            ? 'bg-green-100 text-green-700'
            : 'bg-red-100 text-red-700'
        }`}
      >
        {usageYn || '-'}
      </span>
    );
  }

  if (key === 'dispDtime' || key === 'createdAt') {
    return formatDateString(String(episode[key]));
  }

  return String(episode[key] ?? '-');
};

const ProdChannelDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const channel = (
    location.state as { channel?: usingChannelProps; from?: string }
  )?.channel;
  const from =
    (location.state as { from?: string })?.from ?? '/channel-book-list';
  const isStaging = location.pathname.startsWith('/stg');

  const [episodes, setEpisodes] = useState<usingDataProps[]>([]);
  const [loading, setLoading] = useState(false);
  const [episodePage, setEpisodePage] = useState(1);
  const [episodeTotalPages, setEpisodeTotalPages] = useState(0);
  const [episodeTotalCount, setEpisodeTotalCount] = useState(0);

  const apiInstance = isStaging ? stgApi : api;
  const channelId = Number(id);

  const fetchEpisodes = async (page: number, signal?: AbortSignal) => {
    if (!id || Number.isNaN(channelId)) return;

    setLoading(true);

    try {
      const res = await apiInstance.get(
        `/admin/episode?page=${page}&size=${EPISODE_PAGE_SIZE}&channelId=${channelId}&withPlaylists=Y`,
        { signal }
      );

      const { dataList, pageInfo } = res.data.data;
      setEpisodes(dataList ?? []);
      setEpisodeTotalCount(pageInfo?.totalCount ?? 0);
      setEpisodeTotalPages(
        Math.ceil((pageInfo?.totalCount ?? 0) / EPISODE_PAGE_SIZE)
      );
    } catch (error: unknown) {
      if (
        (error as { name?: string }).name === 'CanceledError' ||
        (error as { name?: string }).name === 'AbortError'
      )
        return;
      console.error('채널 에피소드 조회 실패:', error);
      setEpisodes([]);
      setEpisodeTotalCount(0);
      setEpisodeTotalPages(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    setEpisodePage(1);
    fetchEpisodes(1, controller.signal);
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isStaging]);

  const handlePageChange = (page: number) => {
    setEpisodePage(page);
    fetchEpisodes(page);
  };

  return (
    <div className='p-10 flex flex-col'>
      <h1 className='mb-4 indent-1' style={{ fontSize: '16px' }}>
        <span className='text-gray-500'>채널·도서 관리 / </span>
        <span className='font-bold'>채널 상세</span>
      </h1>

      <div className='w-full rounded-2xl bg-white mt-4 p-8 flex flex-col gap-6 shadow-sm border border-gray-100'>
        <div className='flex items-center justify-between border-b border-gray-100 pb-4'>
          <div>
            <h2 className='text-lg font-semibold'>채널 정보</h2>
            <p className='text-sm text-gray-400 mt-1'>ID: {id}</p>
          </div>
          <button
            onClick={() => navigate(from)}
            className='px-3 py-2 rounded bg-gray-100 text-gray-700 hover:bg-gray-200 transition text-sm'
          >
            목록
          </button>
        </div>

        {channel ? (
          <div className='grid grid-cols-1 lg:grid-cols-2 gap-3'>
            {CHANNEL_FIELD_DEFS.map((field) => {
              const isThumbnailField = field.key === 'thumbnailUrl';

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
                    {formatFieldValue(
                      field.key,
                      channel[field.key] as string | number
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className='text-sm text-gray-500'>
            채널 상세 정보가 전달되지 않아 채널 ID 기준으로 에피소드 목록만
            표시합니다.
          </p>
        )}

        <div className='pt-10 border-t border-gray-100'>
          <div className='flex items-center justify-between mb-3'>
            <h3 className='font-semibold'>등록된 에피소드</h3>
            <span className='text-base font-bold text-gray-500'>
              총 {episodeTotalCount}개
            </span>
          </div>

          {loading ? (
            <div className='py-8 text-center text-gray-500'>
              에피소드 목록을 불러오는 중입니다.
            </div>
          ) : episodes.length === 0 ? (
            <div className='py-8 text-center text-gray-400'>
              표시할 에피소드가 없습니다.
            </div>
          ) : (
            <div className='overflow-x-scroll episode-table-scroll pb-1'>
              <div style={{ minWidth: '920px', width: '100%' }}>
                <div className='flex font-bold py-3 bg-white border-b-2 border-gray-300 w-full'>
                  {EPISODE_COLUMNS.map((col) => (
                    <p
                      key={col.key}
                      className={`px-2 text-sm ${
                        col.isFlex ? 'flex-1 min-w-[280px]' : 'flex-shrink-0'
                      }`}
                      style={
                        col.isFlex
                          ? { minWidth: col.minWidth }
                          : { width: col.width }
                      }
                    >
                      {col.label}
                    </p>
                  ))}
                </div>

                {episodes.map((episode) => (
                  <div
                    key={episode.episodeId}
                    className='flex items-center border-b border-gray-200 py-3 w-full cursor-pointer hover:bg-gray-50'
                    onClick={() =>
                      navigate(`/episode/detail/${episode.episodeId}`)
                    }
                  >
                    {EPISODE_COLUMNS.map((col) => (
                      <div
                        key={col.key}
                        className={`px-2 text-sm ${
                          col.isFlex
                            ? 'flex-1 min-w-[280px] truncate'
                            : 'flex-shrink-0 truncate'
                        }`}
                        style={
                          col.isFlex
                            ? { minWidth: col.minWidth }
                            : { width: col.width }
                        }
                      >
                        {formatEpisodeValue(episode, col.key)}
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
            onChange={handlePageChange}
          />
        </div>
      </div>
    </div>
  );
};

export default ProdChannelDetail;
