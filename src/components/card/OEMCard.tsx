import { useState } from 'react';
import type { OEMGroup } from '@/utils/googleSheets/fetchPickSeriesOEMSheet';

interface OEMCardProps {
  productId: string;
  label: string;
  isConnected: boolean;
  oems: OEMGroup[];
  selectedItems: Record<string, Set<string>>;
  selectedCount: number;
  totalCount: number;
  state: { loading: boolean; error: string | null };
  onToggleAll: (productId: string) => void;
  onToggleOEMAll: (productId: string, oemName: string) => void;
  onToggleOEMItem: (productId: string, oemName: string, item: string) => void;
  selectedDateCount: number;
  getItemExistingDates: (
    productId: string,
    oemName: string,
    item: string
  ) => string[];
}

const ChevronIcon = ({ expanded }: { expanded: boolean }) => (
  <svg
    className={`w-3 h-3 text-gray-400 transition-transform shrink-0 ${expanded ? '' : '-rotate-90'}`}
    viewBox='0 0 20 20'
    fill='currentColor'
  >
    <path
      fillRule='evenodd'
      d='M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z'
      clipRule='evenodd'
    />
  </svg>
);

const OEMCard = ({
  productId,
  label,
  isConnected,
  oems,
  selectedItems,
  selectedCount,
  totalCount,
  state,
  onToggleAll,
  onToggleOEMAll,
  onToggleOEMItem,
  selectedDateCount,
  getItemExistingDates,
}: OEMCardProps) => {
  // 첫 번째 OEM(전체)을 기본 펼침 상태로 초기화
  const [expandedOEMs, setExpandedOEMs] = useState<Set<string>>(
    () => new Set(oems.slice(0, 1).map((o) => o.name))
  );

  const serviceColor =
    label === '픽클'
      ? 'bg-green-500'
      : label === '픽나우'
        ? 'bg-orange-500'
        : 'bg-purple-500';

  const toggleOEMExpand = (oemName: string) => {
    setExpandedOEMs((prev) => {
      const next = new Set(prev);
      if (next.has(oemName)) next.delete(oemName);
      else next.add(oemName);
      return next;
    });
  };

  const allOEMsExpanded = oems.every((oem) => expandedOEMs.has(oem.name));

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
        {isConnected && totalCount > 0 && (
          <button
            onClick={() => onToggleAll(productId)}
            className='text-xs text-gray-400 hover:text-indigo-600 transition-colors cursor-pointer'
          >
            {selectedCount}/{totalCount} 선택
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
        ) : oems.length === 0 ? (
          <div className='px-4 py-8 text-center text-sm text-gray-400'>
            OEM 정보가 없습니다
          </div>
        ) : (
          <>
            {/* 전체 펼치기/접기 */}
            <button
              onClick={() =>
                setExpandedOEMs(
                  allOEMsExpanded ? new Set() : new Set(oems.map((o) => o.name))
                )
              }
              className='w-full flex items-center gap-2 px-4 py-2 border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer'
            >
              <ChevronIcon expanded={allOEMsExpanded} />
              <span className='text-xs text-gray-400'>
                전체 {allOEMsExpanded ? '접기' : '펼치기'}
              </span>
            </button>

            {/* OEM 섹션들 */}
            {oems.map((oem) => {
              const isExpanded = expandedOEMs.has(oem.name);
              const oemSet = selectedItems[oem.name] ?? new Set<string>();
              const oemAllChecked =
                oem.items.length > 0 &&
                oem.items.every((item) => oemSet.has(item));

              return (
                <div key={oem.name}>
                  <button
                    onClick={() => toggleOEMExpand(oem.name)}
                    className='w-full flex items-center gap-2 px-4 py-2.5 hover:bg-gray-50 transition-colors cursor-pointer'
                  >
                    <ChevronIcon expanded={isExpanded} />
                    <input
                      type='checkbox'
                      checked={oemAllChecked}
                      onChange={() => onToggleOEMAll(productId, oem.name)}
                      onClick={(e) => e.stopPropagation()}
                      className='w-4 h-4 accent-indigo-600 shrink-0'
                    />
                    <span className='text-sm font-medium text-gray-700'>
                      {oem.name}
                    </span>
                  </button>

                  {isExpanded && (
                    <div className='pl-9'>
                      {oem.items.map((item) => {
                        const isSelected = oemSet.has(item);
                        const existingDates = getItemExistingDates(
                          productId,
                          oem.name,
                          item
                        );
                        const existCount = existingDates.length;
                        return (
                          <label
                            key={item}
                            className={`flex items-center gap-3 px-4 py-2 mr-4 cursor-pointer transition-colors ${
                              isSelected ? 'bg-indigo-50' : 'hover:bg-gray-50'
                            }`}
                          >
                            <input
                              type='checkbox'
                              checked={isSelected}
                              onChange={() =>
                                onToggleOEMItem(productId, oem.name, item)
                              }
                              className='w-4 h-4 accent-indigo-600 shrink-0 '
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
                            {existCount > 0 &&
                              (existCount === selectedDateCount ? (
                                <span className='text-xs px-1.5 py-0.5 rounded bg-rose-100 text-rose-500 font-medium shrink-0'>
                                  존재
                                </span>
                              ) : (
                                <span className='text-xs px-1.5 py-0.5 rounded bg-rose-100 text-rose-500 font-medium shrink-0'>
                                  {existingDates.length <= 2
                                    ? existingDates
                                        .map((d) =>
                                          d.split('.').slice(1).join('.')
                                        )
                                        .join(', ')
                                    : `${existingDates[0].split('.').slice(1).join('.')} 외 ${existingDates.length - 1}건`}{' '}
                                  존재
                                </span>
                              ))}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
};

export default OEMCard;
