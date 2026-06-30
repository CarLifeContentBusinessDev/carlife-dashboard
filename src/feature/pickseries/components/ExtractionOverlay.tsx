import type { ExtractionProgress } from '@/feature/pickseries/utils/extractPickjoyOEMData';

interface ExtractionOverlayProps {
  status: 'running' | 'done' | 'error';
  progress?: ExtractionProgress | null;
  errorMessage?: string | null;
  onReset: () => void;
}

export default function ExtractionOverlay({
  status,
  progress,
  errorMessage,
  onReset,
}: ExtractionOverlayProps) {
  if (status === 'done') {
    return (
      <div className='absolute inset-0 z-50 bg-white flex items-center justify-center'>
        <div className='flex flex-col items-center gap-5'>
          <div className='w-16 h-16 bg-green-100 rounded-full flex items-center justify-center'>
            <svg
              className='w-8 h-8 text-green-500'
              viewBox='0 0 24 24'
              fill='none'
              stroke='currentColor'
              strokeWidth='3'
              strokeLinecap='round'
              strokeLinejoin='round'
            >
              <polyline points='20 6 9 17 4 12' />
            </svg>
          </div>
          <p className='text-xl font-bold text-gray-800'>시트 반영 완료</p>
          <button
            onClick={onReset}
            className='px-6 py-2 rounded-lg border border-gray-300 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors cursor-pointer'
          >
            처음으로
          </button>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className='absolute inset-0 z-50 bg-white flex items-center justify-center'>
        <div className='flex flex-col items-center gap-5'>
          <div className='w-16 h-16 bg-red-100 rounded-full flex items-center justify-center'>
            <svg
              className='w-8 h-8 text-red-500'
              viewBox='0 0 24 24'
              fill='none'
              stroke='currentColor'
              strokeWidth='3'
              strokeLinecap='round'
              strokeLinejoin='round'
            >
              <line x1='18' y1='6' x2='6' y2='18' />
              <line x1='6' y1='6' x2='18' y2='18' />
            </svg>
          </div>
          <p className='text-xl font-bold text-gray-800'>오류가 발생했습니다</p>
          {errorMessage && (
            <p className='text-sm text-red-500 text-center max-w-sm px-4'>
              {errorMessage}
            </p>
          )}
          <button
            onClick={onReset}
            className='px-6 py-2 rounded-lg border border-gray-300 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors cursor-pointer'
          >
            처음으로
          </button>
        </div>
      </div>
    );
  }

  const percent =
    progress && progress.total > 0
      ? Math.round((progress.completed / progress.total) * 100)
      : 0;

  return (
    <div className='absolute inset-0 z-50 bg-gray-900/50 flex items-center justify-center'>
      <div className='bg-white rounded-2xl px-10 py-8 flex flex-col items-center gap-5 shadow-xl w-80'>
        <div className='w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin' />
        <p className='text-gray-800 font-semibold text-lg'>진행 중</p>
        {progress && (
          <div className='w-full flex flex-col gap-2'>
            <p className='text-xs text-gray-500 text-center leading-snug'>
              {progress.currentLabel}
            </p>
            <div className='w-full bg-gray-100 rounded-full h-2'>
              <div
                className='bg-indigo-600 h-2 rounded-full transition-all duration-300'
                style={{ width: `${percent}%` }}
              />
            </div>
            <p className='text-xs text-gray-400 text-right'>
              {progress.completed} / {progress.total} ({percent}%)
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
