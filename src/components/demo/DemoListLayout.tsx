import { toast } from 'react-toastify';
import Button from '../common/Button';
import Dropdown from '../common/Dropdown';
import { LANGUAGES, type LanguageCode } from '../../constants/languages';
import { useAccessTokenStore } from '../../store/useAccessTokenStore';

export type StatusFilter = 'all' | 'active' | 'inactive';

interface DemoListLayoutProps {
  parentMenu: string;
  childMenu: string;
  count?: number;
  selectedLang: LanguageCode;
  onLangChange: (lang: LanguageCode) => void;
  languageOptions?: readonly { value: string; label: string }[];
  addLabel: string;
  onAdd: () => void;
  extraControls?: React.ReactNode;
  statusFilter?: StatusFilter;
  onStatusFilterChange?: (status: StatusFilter) => void;
  searchableFilter?: StatusFilter;
  onSearchableFilterChange?: (status: StatusFilter) => void;
  filterExtras?: React.ReactNode;
  searchQuery?: string;
  onSearchQueryChange?: (query: string) => void;
  searchPlaceholder?: string;
  children?: React.ReactNode;
}

const FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

const RadioGroup = ({
  label,
  name,
  value,
  onChange,
}: {
  label: string;
  name: string;
  value: StatusFilter;
  onChange: (v: StatusFilter) => void;
}) => (
  <div className='flex items-center gap-3'>
    <span className='text-sm text-gray-600 font-medium'>{label}:</span>
    {FILTER_OPTIONS.map((opt) => (
      <label
        key={opt.value}
        className='flex items-center gap-1.5 cursor-pointer'
      >
        <input
          type='radio'
          name={name}
          value={opt.value}
          checked={value === opt.value}
          onChange={() => onChange(opt.value)}
          className='accent-point-color w-4 h-4 cursor-pointer'
        />
        <span className='text-sm text-gray-700'>{opt.label}</span>
      </label>
    ))}
  </div>
);

const DemoListLayout = ({
  parentMenu,
  childMenu,
  count,
  selectedLang,
  onLangChange,
  languageOptions = LANGUAGES,
  addLabel,
  onAdd: onAddProp,
  extraControls,
  statusFilter = 'all',
  onStatusFilterChange,
  searchableFilter = 'all',
  onSearchableFilterChange,
  filterExtras,
  searchQuery,
  onSearchQueryChange,
  searchPlaceholder = '검색어를 입력하세요.',
  children,
}: DemoListLayoutProps) => {
  const { accessToken } = useAccessTokenStore();

  const onAdd = () => {
    if (!accessToken) {
      toast.warn('관리자 로그인이 필요합니다.');
      return;
    }
    onAddProp();
  };

  return (
    <div className='p-10 flex flex-col'>
      <h1 className='mb-4 indent-1' style={{ fontSize: '16px' }}>
        <span className='text-gray-500'>{parentMenu} / </span>
        <span className='font-bold'>{childMenu}</span>
      </h1>

      <div className='w-full rounded-2xl bg-white mt-4 p-8 flex flex-col'>
        {/* 헤더: 총 개수 + 정렬/추가 */}
        <div className='flex justify-between items-center'>
          <h3 className='text-point-color font-semibold'>
            총 <span className='font-extrabold'>{count}</span>개
          </h3>

          <div className='flex gap-4 items-center'>
            {extraControls}
            <Button onClick={onAdd}>{addLabel}</Button>
          </div>
        </div>

        {/* 필터 바: 언어 + 각종 필터 + 검색 */}
        <div className='flex items-center justify-between mt-4 p-4 bg-gray-50 rounded-xl gap-4'>
          <div className='flex items-center gap-8 flex-wrap'>
            <div className='flex items-center gap-2'>
              <span className='text-sm text-gray-600 font-medium'>국가:</span>
              <Dropdown
                value={selectedLang}
                options={[...languageOptions]}
                onChange={(v) => onLangChange(v as LanguageCode)}
              />
            </div>

            {filterExtras}

            <div className='flex flex-col gap-3'>
              {onStatusFilterChange && (
                <RadioGroup
                  label='Status'
                  name='statusFilter'
                  value={statusFilter}
                  onChange={onStatusFilterChange}
                />
              )}

              {onSearchableFilterChange && (
                <RadioGroup
                  label='Searchable'
                  name='searchableFilter'
                  value={searchableFilter}
                  onChange={onSearchableFilterChange}
                />
              )}
            </div>
          </div>

          {onSearchQueryChange && (
            <div className='flex items-center border border-gray-300 rounded-lg bg-white px-3 py-1.5 gap-2 min-w-[220px]'>
              <input
                type='text'
                value={searchQuery ?? ''}
                onChange={(e) => onSearchQueryChange(e.target.value)}
                placeholder={searchPlaceholder}
                className='outline-none text-sm flex-1 text-gray-700 placeholder-gray-400'
              />
              <svg
                xmlns='http://www.w3.org/2000/svg'
                className='w-4 h-4 text-gray-400 shrink-0'
                fill='none'
                viewBox='0 0 24 24'
                stroke='currentColor'
                strokeWidth={2}
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  d='M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z'
                />
              </svg>
            </div>
          )}
        </div>

        <div className='mt-4'>{children}</div>
      </div>
    </div>
  );
};

export default DemoListLayout;
