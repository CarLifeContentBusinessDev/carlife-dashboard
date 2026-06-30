interface DatePickerSectionProps {
  allDates: string[];
  selectedDates: Set<string>;
  toggleDate: (date: string) => void;
  allSelected: boolean;
  toggleGlobalAll: () => void;
  hasAnyLoggedIn: boolean;
  loggedInProducts: { id: string }[];
  productStates: Record<string, { loading: boolean }>;
  incompleteDates: string[];
  isDateSelectable: (date: string) => boolean;
}

export function DatePickerSection({
  allDates,
  selectedDates,
  toggleDate,
  allSelected,
  toggleGlobalAll,
  hasAnyLoggedIn,
  loggedInProducts,
  productStates,
  incompleteDates,
  isDateSelectable,
}: DatePickerSectionProps) {
  return (
    <div className='flex flex-col gap-2 mb-5'>
      <div className='flex items-center gap-3'>
        <span className='text-sm font-medium text-gray-500 shrink-0'>
          주차 선택
        </span>
        {allDates.length > 0 && (
          <label className='ml-auto flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer shrink-0'>
            <input
              type='checkbox'
              checked={allSelected}
              onChange={toggleGlobalAll}
              className='w-4 h-4 accent-indigo-600'
            />
            전체 선택
          </label>
        )}
      </div>
      <div className='flex gap-2 flex-wrap'>
        {!hasAnyLoggedIn ? (
          <span className='text-sm text-gray-400'>
            서버 연결 후 사용 가능합니다.
          </span>
        ) : loggedInProducts.some((pg) => productStates[pg.id]?.loading) ? (
          <span className='text-sm text-gray-400'>날짜를 불러오는 중...</span>
        ) : allDates.length === 0 ? (
          <span className='text-sm text-gray-400'>
            시트에서 날짜를 찾지 못했습니다. 브라우저 콘솔을 확인해주세요.
          </span>
        ) : incompleteDates.length === 0 ? (
          <span className='text-sm text-gray-400'>
            모든 주차가 완료되었습니다.
          </span>
        ) : (
          incompleteDates.map((date) => {
            const selectable = isDateSelectable(date);
            return (
              <button
                key={date}
                onClick={() => toggleDate(date)}
                disabled={!selectable}
                className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  !selectable
                    ? 'bg-white border-gray-200 text-gray-300 cursor-not-allowed'
                    : selectedDates.has(date)
                      ? 'bg-indigo-600 border-indigo-600 text-white cursor-pointer'
                      : 'bg-white border-gray-300 text-gray-700 hover:border-indigo-400 cursor-pointer'
                }`}
              >
                {date}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
