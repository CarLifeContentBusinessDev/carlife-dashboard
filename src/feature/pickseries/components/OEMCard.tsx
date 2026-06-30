import { ChevronIcon } from '@/assets/ChevronIcon';
import CardBodyStatus from '@/feature/pickseries/components/CardBodyStatus';
import { CardHeader } from '@/feature/pickseries/components/CardHeader';
import ExistingDatesBadge from '@/feature/pickseries/components/ExistingDatesBadge';
import type { OEMGroup } from '@/feature/pickseries/utils/fetchPickSeriesOEMSheet';
import { useState } from 'react';

interface OEMCardProps {
  productId: string;
  isConnected: boolean;
  label: string;
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
  const [expandedOEMs, setExpandedOEMs] = useState<Set<string>>(new Set());
  const [hasInitializedExpand, setHasInitializedExpand] = useState(false);

  if (oems.length > 0 && !hasInitializedExpand) {
    setExpandedOEMs(new Set(oems.slice(0, 1).map((o) => o.name)));
    setHasInitializedExpand(true);
  }

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
      <CardHeader
        label={label}
        isConnected={isConnected}
        selectedCount={selectedCount}
        totalCount={totalCount}
        onClick={() => onToggleAll(productId)}
      />

      <div className='overflow-y-auto max-h-[420px] scrollbar-hide'>
        <CardBodyStatus
          isConnected={isConnected}
          state={state}
          isEmpty={oems.length === 0}
          emptyMessage='OEM 정보가 없습니다'
        >
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
                  </div>
                )}
              </div>
            );
          })}
        </CardBodyStatus>
      </div>
    </div>
  );
};

export default OEMCard;
