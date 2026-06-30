import { useEffect, useState } from 'react';

export const ThumbnailPreview = ({
  url,
  title,
}: {
  url: string;
  title: string;
}) => {
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [url]);

  const showPlaceholder = !url || imgError;

  return (
    <div className='flex flex-col items-start gap-4 p-4'>
      {showPlaceholder ? (
        <div className='w-40 h-40 rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center flex-shrink-0 bg-white'>
          <svg width='40' height='40' fill='none' viewBox='0 0 24 24'>
            <rect
              x='3'
              y='3'
              width='18'
              height='18'
              rx='3'
              stroke='#d1d5db'
              strokeWidth='1.5'
            />
            <circle
              cx='8.5'
              cy='8.5'
              r='1.5'
              stroke='#d1d5db'
              strokeWidth='1.5'
            />
            <path
              d='M3 16l5-5 4 4 3-3 6 6'
              stroke='#d1d5db'
              strokeWidth='1.5'
              strokeLinecap='round'
              strokeLinejoin='round'
            />
          </svg>
        </div>
      ) : (
        <img
          src={url}
          alt={title}
          className='w-40 h-40 object-cover rounded-lg shadow-sm flex-shrink-0'
          onError={() => setImgError(true)}
        />
      )}
      <div className='flex flex-col gap-1'>
        <p className='text-xs font-semibold uppercase tracking-widest text-gray-400'>
          썸네일 미리보기
        </p>
        {!url && (
          <p className='text-xs text-gray-400'>
            URL을 입력하면 미리보기가 표시됩니다
          </p>
        )}
        {url && imgError && (
          <p className='text-xs text-red-400'>이미지를 불러올 수 없습니다</p>
        )}
      </div>
    </div>
  );
};
