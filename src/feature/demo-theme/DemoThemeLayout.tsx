import DemoListLayout, {
  type StatusFilter,
} from '../../components/demo/DemoListLayout';
import Dropdown from '../../components/common/Dropdown';
import LoadingOverlay from '../../components/common/LoadingOverlay';
import SortControls from '../../components/table/SortControls';
import type { LanguageCode } from '../../constants/languages';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DemoThemeList from './DemoThemeList';
import fetchAllSupabaseRows from '../../utils/api/fetchAllSupabaseRows';
import parseLanguages from '../../utils/format/parseLanguages';
import useListSort from '../../hook/useListSort';
import type { Theme } from '../../types/demoContents';

const SORT_KEY_OPTIONS: Array<{ value: 'id' | 'order'; label: string }> = [
  { value: 'id', label: 'ID 기준' },
  { value: 'order', label: '순위 기준' },
];

const DemoThemeLayout = () => {
  const navigate = useNavigate();
  const [themes, setThemes] = useState<Theme[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedLang, setSelectedLang] = useState<LanguageCode>('all');
  const [sections, setSections] = useState<{ id: number; title: string }[]>([]);
  const [selectedSection, setSelectedSection] = useState('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchableFilter, setSearchableFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchThemes = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchAllSupabaseRows<Theme>({
        table: 'themes',
        select: '*, sections(title)',
      });
      setThemes(data);
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchThemes();
    fetchAllSupabaseRows<{ id: number; title: string }>({
      table: 'sections',
      select: 'id, title',
      orderColumn: 'id',
    }).then(setSections);
  }, []);

  const sectionOptions = [
    { value: 'all', label: '전체 섹션' },
    ...sections.map((s) => ({ value: String(s.id), label: s.title })),
  ];

  const filteredTheme = themes
    .filter((t) => {
      if (selectedLang === 'all') return true;
      return parseLanguages(t.language).includes(selectedLang);
    })
    .filter((t) => {
      if (selectedSection === 'all') return true;
      return String(t.section_id) === selectedSection;
    })
    .filter((t) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        t.title?.toLowerCase().includes(q) ||
        t.subtitle?.toLowerCase().includes(q)
      );
    });

  const {
    sortKey,
    setSortKey,
    sortDirection,
    setSortDirection,
    sortedData: sortedThemes,
  } = useListSort({
    data: filteredTheme,
    sortOptions: SORT_KEY_OPTIONS,
    initialSortKey: 'id',
    initialSortDirection: 'asc',
    emptyLastOnAscKeys: ['order'],
  });

  return (
    <DemoListLayout
      parentMenu='데모 콘텐츠 관리'
      childMenu='테마 관리'
      count={sortedThemes.length}
      selectedLang={selectedLang}
      onLangChange={setSelectedLang}
      extraControls={
        <SortControls
          sortKey={sortKey}
          sortOptions={SORT_KEY_OPTIONS}
          onSortKeyChange={setSortKey}
          sortDirection={sortDirection}
          onSortDirectionChange={setSortDirection}
        />
      }
      filterExtras={
        <div className='flex items-center gap-2'>
          <span className='text-sm text-gray-600 font-medium'>Section:</span>
          <Dropdown
            value={selectedSection}
            options={sectionOptions}
            onChange={setSelectedSection}
          />
        </div>
      }
      statusFilter={statusFilter}
      onStatusFilterChange={setStatusFilter}
      searchableFilter={searchableFilter}
      onSearchableFilterChange={setSearchableFilter}
      searchQuery={searchQuery}
      onSearchQueryChange={setSearchQuery}
      searchPlaceholder='테마명을 입력하세요.'
      addLabel='테마 추가'
      onAdd={() => navigate('/demo/theme/new')}
    >
      <LoadingOverlay loading={loading}>
        테마 목록을 불러오는 중입니다.
      </LoadingOverlay>

      {!loading && !error && (
        <DemoThemeList
          themes={sortedThemes}
          selectedLang={selectedLang}
          onDeleted={fetchThemes}
        />
      )}
    </DemoListLayout>
  );
};

export default DemoThemeLayout;
