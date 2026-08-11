import { serviceColor } from '@/feature/pickseries/types/pickSeriesColor';

interface CardHeaderProps {
  label: string;
  isConnected: boolean;
  selectedCount?: number;
  totalCount?: number;
  onClick: () => void;
  isActive?: boolean;
}

export const CardHeader = ({
  label,
  isConnected,
  selectedCount,
  totalCount,
  onClick,
  isActive = true,
}: CardHeaderProps) => {
  return (
    <div className='flex items-center justify-between px-4 py-3 border-b border-gray-100'>
      <div className='flex items-center gap-2'>
        <span
          className={`w-2 h-2 rounded-full shrink-0 ${isConnected ? serviceColor(label) : 'bg-gray-300'}`}
        />
        <span className='font-semibold text-gray-800'>{label}</span>
      </div>
      {isConnected && !!totalCount && isActive && (
        <button
          onClick={() => onClick()}
          className='text-xs text-gray-400 hover:text-indigo-600 transition-colors cursor-pointer'
        >
          {selectedCount}/{totalCount} 선택
        </button>
      )}
    </div>
  );
};
