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
  // 이 서비스가 아직 API 연동하지 않은 항목 (체크 불가, 흐리게 표시)
  unsupportedItems?: Set<string>;
  // 현재 선택으로는 추출되지 않는 항목 (전부 이미 존재 / 담당 주차 없음)
  // → 체크된 채로 회색 비활성
  lockedItems?: Set<string>;
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
  unsupportedItems,
  lockedItems,
}: WeeklyCardProps) => {
  const supportedTotal = items.length - (unsupportedItems?.size ?? 0);

  return (
    <div className='rounded-xl border border-gray-200 bg-white overflow-hidden'>
      <CardHeader
        label={label}
        isConnected={isConnected}
        selectedCount={selectedCount}
        totalCount={supportedTotal}
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
              const unsupported = unsupportedItems?.has(item) ?? false;
              const locked = !unsupported && (lockedItems?.has(item) ?? false);
              const inert = unsupported || locked;
              const isSelected = selected.has(item);
              const existingDates = getItemExistingDates(productId, item);
              return (
                <label
                  key={item}
                  className={`flex items-center gap-3 px-4 py-2.5 transition-colors ${
                    unsupported
                      ? 'opacity-40 cursor-not-allowed'
                      : locked
                        ? 'bg-gray-50 cursor-not-allowed'
                        : isSelected
                          ? 'bg-indigo-50 cursor-pointer'
                          : 'hover:bg-gray-50 cursor-pointer'
                  }`}
                >
                  <input
                    type='checkbox'
                    checked={isSelected}
                    disabled={inert}
                    onChange={() => {
                      if (!inert) toggleItem(productId, item);
                    }}
                    className='w-4 h-4 accent-indigo-600 shrink-0'
                  />
                  <span
                    className={`text-sm flex-1 ${
                      locked
                        ? 'text-gray-400'
                        : isSelected
                          ? 'text-indigo-800 font-medium'
                          : 'text-gray-700'
                    }`}
                  >
                    {item}
                  </span>
                  {unsupported ? (
                    <span className='text-xs text-gray-400 shrink-0'>
                      미연동
                    </span>
                  ) : (
                    <ExistingDatesBadge
                      existingDates={existingDates}
                      selectedDateCount={selectedDateCount}
                    />
                  )}
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
