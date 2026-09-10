import { serviceColor } from '@/feature/pickseries/types/pickSeriesColor';

interface CardHeaderProps {
  label: string;
  isConnected: boolean;
  selectedCount?: number;
  totalCount?: number;
  onClick: () => void;
  isActive?: boolean;
  operatingSince?: string;
}

function formatOperatingSince(date: string): string {
  const parts = date.split('.');
  if (parts.length < 3) return date;
  return `${Number(parts[1])}.${Number(parts[2])}`;
}

export const CardHeader = ({
  label,
  isConnected,
  selectedCount,
  totalCount,
  onClick,
  isActive = true,
  operatingSince,
}: CardHeaderProps) => {
  return (
    <div className='flex items-center justify-between px-4 py-3 border-b border-gray-100'>
      <div className='flex items-center gap-2'>
        <span
          className={`w-2 h-2 rounded-full shrink-0 ${isConnected ? serviceColor(label) : 'bg-gray-300'}`}
        />
        <span className='font-semibold text-gray-800'>{label}</span>
        {isConnected && operatingSince && (
          <span className='text-xs text-gray-400 font-normal'>
            운영 시작 {formatOperatingSince(operatingSince)}
          </span>
        )}
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
