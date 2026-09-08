import CardBodyStatus from '@/feature/pickseries/components/CardBodyStatus';
import { CardHeader } from '@/feature/pickseries/components/CardHeader';
import ExistingDatesBadge from '@/feature/pickseries/components/ExistingDatesBadge';

interface WeeklyCardProps {
  productId: string;
  isConnected: boolean;
  label: string;
  items: string[];
  selected: Set<string>;
  selectedCount?: number;
  selectedDateCount: number;
  state: {
    loading: boolean;
    error: string | null;
  };
  onClick: (productId: string) => void;
  getItemExistingDates: (productId: string, item: string) => string[];
  toggleItem: (productId: string, item: string) => void;
  isActive?: boolean;
  operatingSince?: string;
}

const WeeklyCard = ({
  productId,
  isConnected,
  label,
  items,
  selected,
  selectedCount,
  selectedDateCount,
  state,
  onClick,
  getItemExistingDates,
  toggleItem,
  isActive = true,
  operatingSince,
}: WeeklyCardProps) => {
  return (
    <div className='rounded-xl border border-gray-200 bg-white overflow-hidden'>
      <CardHeader
        label={label}
        isConnected={isConnected}
        selectedCount={selectedCount}
        totalCount={items.length}
        onClick={() => onClick(productId)}
        isActive={isActive}
        operatingSince={operatingSince}
      />

      <div className='overflow-y-auto max-h-105 scrollbar-hide'>
        {isActive && (
          <CardBodyStatus
            isConnected={isConnected}
            state={state}
            isEmpty={items.length === 0}
          >
            {items.map((item) => {
              const isSelected = selected.has(item);
              const existingDates = getItemExistingDates(productId, item);
              return (
                <label
                  key={item}
                  className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${
                    isSelected ? 'bg-indigo-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <input
                    type='checkbox'
                    checked={isSelected}
                    onChange={() => toggleItem(productId, item)}
                    className='w-4 h-4 accent-indigo-600 shrink-0'
                  />
                  <span
                    className={`text-sm flex-1 ${
                      isSelected
                        ? 'text-indigo-800 font-medium'
                        : 'text-gray-700'
                    }`}
                  >
                    {item}
                  </span>
                  <ExistingDatesBadge
                    existingDates={existingDates}
                    selectedDateCount={selectedDateCount}
                  />
                </label>
              );
            })}
          </CardBodyStatus>
        )}
        {!isActive && (
          <div className='flex items-center justify-center h-32 text-gray-400 text-sm'>
            아직 연동되지 않은 서비스입니다.
          </div>
        )}
      </div>
    </div>
  );
};

export default WeeklyCard;
