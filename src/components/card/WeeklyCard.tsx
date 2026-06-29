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
}: WeeklyCardProps) => {
  const serviceColor =
    label === '픽클'
      ? 'bg-green-500'
      : label === '픽나우'
        ? 'bg-orange-500'
        : 'bg-purple-500';
  return (
    <div className='rounded-xl border border-gray-200 bg-white overflow-hidden'>
      {/* 카드 헤더 */}
      <div className='flex items-center justify-between px-4 py-3 border-b border-gray-100'>
        <div className='flex items-center gap-2'>
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${isConnected ? serviceColor : 'bg-gray-300'}`}
          />
          <span className='font-semibold text-gray-800'>{label}</span>
        </div>
        {isConnected && items.length > 0 && (
          <button
            onClick={() => onClick(productId)}
            className='text-xs text-gray-400 hover:text-indigo-600 transition-colors cursor-pointer'
          >
            {selectedCount}/{items.length} 선택
          </button>
        )}
      </div>

      {/* 카드 바디 */}
      <div className='overflow-y-auto max-h-[420px] scrollbar-hide'>
        {!isConnected ? (
          <div className='px-4 py-8 text-center text-sm text-gray-400'>
            서버 미연결
          </div>
        ) : state.loading ? (
          <div className='px-4 py-8 text-center text-sm text-gray-400'>
            불러오는 중...
          </div>
        ) : state.error ? (
          <div className='px-4 py-8 text-center text-sm text-red-400'>
            {state.error}
          </div>
        ) : items.length === 0 ? (
          <div className='px-4 py-8 text-center text-sm text-gray-400'>
            항목이 없습니다
          </div>
        ) : (
          items.map((item) => {
            const isSelected = selected.has(item);
            const existingDates = getItemExistingDates(productId, item);
            const existCount = existingDates.length;
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
                    isSelected ? 'text-indigo-800 font-medium' : 'text-gray-700'
                  }`}
                >
                  {item}
                </span>
                {existCount > 0 &&
                  (existCount === selectedDateCount ? (
                    <span className='text-xs px-1.5 py-0.5 rounded bg-rose-100 text-rose-500 font-medium shrink-0'>
                      존재
                    </span>
                  ) : (
                    <span className='text-xs px-1.5 py-0.5 rounded bg-rose-100 text-rose-500 font-medium shrink-0'>
                      {existingDates.length <= 2
                        ? existingDates
                            .map((d) => d.split('.').slice(1).join('.'))
                            .join(', ')
                        : `${existingDates[0].split('.').slice(1).join('.')} 외 ${existingDates.length - 1}건`}{' '}
                      존재
                    </span>
                  ))}
              </label>
            );
          })
        )}
      </div>
    </div>
  );
};

export default WeeklyCard;
