import { GREEN_BADGE_STYLE, RED_BADGE_STYLE } from '@/constants/badgeStyles';
import type { usingDataProps } from '@/shared/types/pickleProdContents';
import { api, stgApi } from '@/shared/utils/api/api';
import formatDateString from '@/shared/utils/format/formatDateString';
import { formatPlayTime } from '@/shared/utils/format/formatPlayTime';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

const FIELD_DEFS: { key: keyof usingDataProps; label: string }[] = [
  // { key: 'episodeId', label: '에피소드 ID' },
  // { key: 'usageYn', label: '활성 상태' },
  { key: 'thumbnailUrl', label: '썸네일' },
  { key: 'channelId', label: '채널 ID' },
  { key: 'episodeName', label: '에피소드명' },
  { key: 'channelName', label: '채널명' },
  { key: 'dispDtime', label: '게시일자' },
  { key: 'createdAt', label: '등록일자' },
  { key: 'audioUrl', label: '오디오' },
  { key: 'playTime', label: '에피소드 시간' },
  { key: 'usageYn', label: '활성 상태' },
  { key: 'likeCnt', label: '좋아요수' },
  { key: 'listenCnt', label: '청취수' },
];

const isImageUrl = (url: string) =>
  /\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i.test(url) || url.includes('thumbnail');

const isAudioUrl = (url: string) =>
  /\.(mp3|wav|m4a|aac|ogg|flac|m3u8)(\?.*)?$/i.test(url) ||
  url.toLowerCase().includes('audio');

const ProdEpisodeDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const stateEpisode = (
    location.state as { episode?: usingDataProps; from?: string }
  )?.episode;
  const from = (location.state as { from?: string })?.from ?? '/';

  const [episode, setEpisode] = useState<usingDataProps | null>(
    stateEpisode ?? null
  );
  const [loading, setLoading] = useState(!stateEpisode);
  const [fetchError, setFetchError] = useState(false);
  const [audioDuration, setAudioDuration] = useState<number | null>(null);

  useEffect(() => {
    setAudioDuration(null);
  }, [id]);

  const isStaging = location.pathname.startsWith('/stg/');

  useEffect(() => {
    if (stateEpisode || !id) return;

    const controller = new AbortController();
    const apiInstance = isStaging ? stgApi : api;

    apiInstance
      .get<{ data: usingDataProps }>(`/admin/episode/${id}`, {
        signal: controller.signal,
      })
      .then((res) => setEpisode(res.data.data))
      .catch((err) => {
        if (err.name !== 'CanceledError' && err.name !== 'AbortError') {
          setFetchError(true);
        }
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [id, stateEpisode, location.pathname]);

  const renderValue = (key: keyof usingDataProps, value: string | number) => {
    if (key === 'usageYn') {
      return (
        <span
          className={`inline-flex items-center px-3 py-1 rounded-lg text-sm font-bold border ${
            value === 'Y'
              ? `${GREEN_BADGE_STYLE} border-green-200`
              : `${RED_BADGE_STYLE} border-red-200`
          }`}
        >
          {value === 'Y' ? 'Active' : 'Inactive'}
        </span>
      );
    }

    if (key === 'dispDtime' || key === 'createdAt') {
      return <span>{formatDateString(String(value))}</span>;
    }

    if (key === 'playTime') {
      const numValue = Number(value);

      const seconds =
        audioDuration ?? (!isNaN(numValue) && numValue > 0 ? numValue : null);

      return <span>{seconds != null ? formatPlayTime(seconds) : '-'}</span>;
    }

    if (typeof value === 'string' && value.startsWith('http')) {
      if (isImageUrl(value)) {
        return (
          <div className='flex flex-col gap-2'>
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
          </div>
        );
      }

      if (isAudioUrl(value)) {
        return (
          <div className='flex flex-col gap-2 w-full max-w-xl'>
            <audio
              controls
              preload='metadata'
              className='w-full'
              onLoadedMetadata={(e) => {
                const dur = e.currentTarget.duration;
                if (isFinite(dur) && dur > 0) {
                  const rounded = Math.round(dur);
                  setAudioDuration(rounded);
                  // saveAudioDurationToCache(value, rounded);
                }
              }}
            >
              <source src={value} />
            </audio>
          </div>
        );
      }

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

    return <span className='break-all'>{String(value ?? '-')}</span>;
  };

  if (loading) {
    return (
      <div className='p-10 flex items-center justify-center'>
        <p className='text-gray-400 text-sm'>불러오는 중...</p>
      </div>
    );
  }

  if (fetchError || !episode) {
    return (
      <div className='p-10 flex flex-col items-center gap-4'>
        <p className='text-gray-500'>에피소드 정보를 불러올 수 없습니다.</p>
        <button
          onClick={() => navigate(from)}
          className='px-4 py-2 rounded bg-gray-100 text-gray-700 hover:bg-gray-200 transition text-sm'
        >
          목록으로
        </button>
      </div>
    );
  }

  const topWideKeys: (keyof usingDataProps)[] = ['episodeName'];
  const topWideFields = FIELD_DEFS.filter((f) => topWideKeys.includes(f.key));
  const narrowFields = FIELD_DEFS.filter((f) => !topWideKeys.includes(f.key));

  return (
    <div className='p-10 flex flex-col'>
      <h1 className='mb-4 indent-1' style={{ fontSize: '16px' }}>
        <span className='text-gray-500'>에피소드 관리 / </span>
        <span className='font-bold'>에피소드 상세</span>
      </h1>

      <div className='w-full rounded-2xl bg-white mt-4 p-8 flex flex-col gap-6 shadow-sm border border-gray-100'>
        <div className='flex items-center justify-between border-b border-gray-100 pb-4'>
          <div>
            <h2 className='text-lg font-semibold'>상세 정보</h2>
            <p className='text-sm text-gray-400 mt-1'>ID: {id}</p>
          </div>
          <button
            onClick={() =>
              isStaging ? navigate(`/stg/episodes`) : navigate(`/episodes`)
            }
            className='px-3 py-2 rounded bg-gray-100 text-gray-700 hover:bg-gray-200 transition text-sm'
          >
            목록
          </button>
        </div>

        {/* 필드 그리드 */}
        <div className='grid grid-cols-1 gap-3'>
          {topWideFields.map((field) => (
            <div
              key={field.key}
              className='grid grid-cols-[170px_1fr] rounded-xl border border-gray-100 overflow-hidden'
            >
              <div className='px-4 py-4 bg-gray-50 font-semibold text-sm text-gray-600'>
                {field.label}
              </div>
              <div className='px-4 py-4 text-sm bg-white break-words min-w-0'>
                {renderValue(field.key, episode[field.key] as string | number)}
              </div>
            </div>
          ))}

          <div className='grid grid-cols-1 lg:grid-cols-2 gap-3'>
            {narrowFields.map((field) => {
              const isThumbnailField = field.key === 'thumbnailUrl';
              const isAudioField = field.key === 'audioUrl';
              return (
                <div
                  key={field.key}
                  className={`grid grid-cols-[170px_1fr] rounded-xl border border-gray-100 overflow-hidden ${
                    isThumbnailField ? 'lg:row-span-4' : ''
                  } ${isAudioField ? 'lg:col-span-2' : ''}`}
                >
                  <div
                    className={`px-4 bg-gray-50 font-semibold text-sm text-gray-600 ${
                      isThumbnailField || isAudioField ? 'py-4' : 'py-3'
                    }`}
                  >
                    {field.label}
                  </div>
                  <div
                    className={`px-4 text-sm bg-white break-all ${
                      isThumbnailField
                        ? 'py-4 min-h-[180px] flex items-start'
                        : isAudioField
                          ? 'py-4'
                          : 'py-3'
                    }`}
                  >
                    {renderValue(
                      field.key,
                      episode[field.key] as string | number
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProdEpisodeDetail;
