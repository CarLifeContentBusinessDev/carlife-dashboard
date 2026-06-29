import Button from '@/components/common/Button';

interface BottomBarProps {
  handleReset: () => void;
  activeSelectedDates: string[];
  onClick: () => void | Promise<void>;
  extractDisabled?: boolean;
}

export const BottomBar = ({
  handleReset,
  activeSelectedDates,
  onClick,
  extractDisabled,
}: BottomBarProps) => {
  const isDisabled = extractDisabled ?? activeSelectedDates.length === 0;

  return (
    <div className='sticky bottom-0 bg-white border-t border-gray-200 -mx-0 px-6 py-3 flex items-center justify-end z-10'>
      <div className='flex items-center gap-2'>
        <button
          onClick={handleReset}
          className='px-4 py-2 rounded-lg border border-rose-300 text-rose-500 text-sm font-medium hover:bg-rose-50 transition-colors cursor-pointer'
        >
          X 초기화
        </button>
        <Button disabled={isDisabled} onClick={onClick}>
          데이터 추출 &gt;
        </Button>
      </div>
    </div>
  );
};
