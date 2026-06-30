import Dropdown from '@/shared/components/common/Dropdown';
import type { SortDirection, SortOption } from '@/shared/hooks/useListSort';

interface SortControlsProps<K extends string> {
  sortKey: K;
  sortOptions: SortOption<K>[];
  onSortKeyChange: (key: K) => void;
  sortDirection: SortDirection;
  onSortDirectionChange: (direction: SortDirection) => void;
}

const SORT_DIRECTION_OPTIONS = [
  { value: 'asc', label: '오름차순' },
  { value: 'desc', label: '내림차순' },
];

function SortControls<K extends string>({
  sortKey,
  sortOptions,
  onSortKeyChange,
  sortDirection,
  onSortDirectionChange,
}: SortControlsProps<K>) {
  return (
    <div className='flex items-center gap-2'>
      {sortOptions.length > 1 && (
        <Dropdown
          value={sortKey}
          options={sortOptions}
          onChange={(v) => onSortKeyChange(v as K)}
        />
      )}

      <Dropdown
        value={sortDirection}
        options={SORT_DIRECTION_OPTIONS}
        onChange={(v) => onSortDirectionChange(v as SortDirection)}
      />
    </div>
  );
}

export default SortControls;
