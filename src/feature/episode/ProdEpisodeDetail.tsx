import { useLocation, useNavigate, useParams } from 'react-router-dom';
import type { usingDataProps } from '../../types/type';
import formatDateString from '../../utils/formatDateString';
import { formatPlayTime } from '../../utils/formatPlayTime';

const FIELD_DEFS: { key: keyof usingDataProps; label: string }[] = [
  // { key: 'episodeId', label: '에피소드 ID' },
  // { key: 'usageYn', label: '활성 상태' },
  { key: 'channelId', label: '채널 ID' },
  { key: 'channelName', label: '채널명' },
  { key: 'episodeName', label: '에피소드명' },
  { key: 'dispDtime', label: '게시일자' },
  { key: 'createdAt', label: '등록일자' },
  { key: 'playTime', label: '에피소드 시간' },
  { key: 'usageYn', label: '상태' },
  { key: 'likeCnt', label: '좋아요수' },
  { key: 'listenCnt', label: '청취수' },
  { key: 'thumbnailUrl', label: '썸네일 URL' },
  { key: 'audioUrl', label: '오디오 URL' },
];

const isImageUrl = (url: string) =>
  /\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i.test(url) || url.includes('thumbnail');

const isAudioUrl = (url: string) =>
  /\.(mp3|wav|m4a|aac|ogg|flac)(\?.*)?$/i.test(url) ||
  url.toLowerCase().includes('audio');

const renderValue = (key: keyof usingDataProps, value: string | number) => {
  if (key === 'usageYn') {
    return (
      <span
        className={`inline-flex items-center px-3 py-1 rounded-lg text-sm font-bold border ${
          value === 'Y'
            ? 'bg-green-100 text-green-700 border-green-200'
            : 'bg-red-100 text-red-700 border-red-200'
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
    return <span>{formatPlayTime(Number(value))}</span>;
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
          <audio controls preload='metadata' className='w-full'>
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

const ProdEpisodeDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const episode = (
    location.state as { episode?: usingDataProps; from?: string }
  )?.episode;
  const from = (location.state as { from?: string })?.from ?? '/';

  if (!episode) {
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

  const wideKeys: (keyof usingDataProps)[] = [
    'thumbnailUrl',
    'audioUrl',
    'episodeName',
  ];

  const narrowFields = FIELD_DEFS.filter((f) => !wideKeys.includes(f.key));
  const wideFields = FIELD_DEFS.filter((f) => wideKeys.includes(f.key));

  const narrowPairs: { key: keyof usingDataProps; label: string }[][] = [];
  for (let i = 0; i < narrowFields.length; i += 2) {
    narrowPairs.push(narrowFields.slice(i, i + 2));
  }

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
            onClick={() => navigate(from)}
            className='px-3 py-2 rounded bg-gray-100 text-gray-700 hover:bg-gray-200 transition text-sm'
          >
            목록
          </button>
        </div>

        {/* 필드 그리드 */}
        <div className='grid grid-cols-1 gap-3'>
          {/* 넓은 필드 (에피소드명, 썸네일, 오디오) */}
          {wideFields.map((field) => (
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

          {/* 좁은 필드 2열 페어 */}
          {narrowPairs.map((pair, pairIdx) => (
            <div
              key={pairIdx}
              className='grid grid-cols-1 lg:grid-cols-2 gap-3'
            >
              {pair.map((field) => (
                <div
                  key={field.key}
                  className='grid grid-cols-[170px_1fr] rounded-xl border border-gray-100 overflow-hidden'
                >
                  <div className='px-4 py-3 bg-gray-50 font-semibold text-sm text-gray-600'>
                    {field.label}
                  </div>
                  <div className='px-4 py-3 text-sm bg-white'>
                    {renderValue(
                      field.key,
                      episode[field.key] as string | number
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ProdEpisodeDetail;
