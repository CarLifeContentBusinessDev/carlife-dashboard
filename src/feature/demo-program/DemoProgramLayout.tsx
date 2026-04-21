import { useEffect, useState } from 'react';
import DemoListLayout, {
  type StatusFilter,
} from '../../components/demo/DemoListLayout';
import LoadingOverlay from '../../components/common/LoadingOverlay';
import DemoProgramList from './DemoProgramList';
import type { LanguageCode } from '../../constants/languages';
import { useNavigate } from 'react-router-dom';
import SortControls from '../../components/table/SortControls';
import type { Program } from '../../types/demoContents';
import useListSort from '../../hook/useListSort';
import parseLanguages from '../../utils/format/parseLanguages';
import fetchAllSupabaseRows from '../../utils/api/fetchAllSupabaseRows';

const SORT_KEY_OPTIONS: Array<{ value: 'id'; label: string }> = [
  { value: 'id', label: 'ID 기준' },
];

const DemoProgramLayout = () => {
  const navigate = useNavigate();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedLang, setSelectedLang] = useState<LanguageCode>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchableFilter, setSearchableFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchPrograms = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchAllSupabaseRows<Program>({
        table: 'programs',
        select: '*, categories(title), broadcastings(title, channel)',
        orderColumn: 'id',
      });
      setPrograms(data);
    } catch (error) {
      setError((error as Error).message);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchPrograms();
  }, []);

  const filteredPrograms = programs
    .filter((prog) => {
      if (selectedLang === 'all') return true;
      const langs = parseLanguages(prog.language);
      return langs.includes(selectedLang);
    })
    .filter((prog) => {
      if (statusFilter === 'all') return true;
      return statusFilter === 'active' ? prog.is_active : !prog.is_active;
    })
    .filter((prog) => {
      if (searchableFilter === 'all') return true;
      return searchableFilter === 'active'
        ? prog.is_searchable
        : !prog.is_searchable;
    })
    .filter((prog) => {
      if (!searchQuery) return true;
      return prog.title?.toLowerCase().includes(searchQuery.toLowerCase());
    });

  const displayPrograms = filteredPrograms.map((prog) => {
    const broadcasting = (prog as any).broadcastings;
    const broadcastingLabel = [broadcasting?.title, broadcasting?.channel]
      .filter(Boolean)
      .join(' ');

    return {
      ...prog,
      broadcastingLabel,
    };
  });

  const {
    sortKey,
    setSortKey,
    sortDirection,
    setSortDirection,
    sortedData: sortedPrograms,
  } = useListSort({
    data: displayPrograms,
    sortOptions: SORT_KEY_OPTIONS,
    initialSortKey: 'id',
    initialSortDirection: 'asc',
  });

  return (
    <DemoListLayout
      parentMenu='데모 콘텐츠 관리'
      childMenu='프로그램 관리'
      count={sortedPrograms.length}
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
      statusFilter={statusFilter}
      onStatusFilterChange={setStatusFilter}
      searchableFilter={searchableFilter}
      onSearchableFilterChange={setSearchableFilter}
      searchQuery={searchQuery}
      onSearchQueryChange={setSearchQuery}
      searchPlaceholder='프로그램명을 입력하세요.'
      addLabel='프로그램 추가'
      onAdd={() => navigate('/demo/program/new')}
    >
      <LoadingOverlay loading={loading}>
        프로그램 목록을 불러오는 중입니다.
      </LoadingOverlay>

      {!loading && !error && (
        <DemoProgramList
          programs={sortedPrograms}
          selectedLang={selectedLang}
          onDeleted={fetchPrograms}
        />
      )}
    </DemoListLayout>
  );
};

export default DemoProgramLayout;
