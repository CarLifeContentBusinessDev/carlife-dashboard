import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LoadingOverlay from '../../components/common/LoadingOverlay';
import { type LanguageCode } from '../../constants/languages';
import DemoListLayout, {
  type StatusFilter,
} from '../../components/demo/DemoListLayout';
import type { Broadcasting } from '../../types/demoContents';
import parseLanguages from '../../utils/format/parseLanguages';
import DemoBroadcastingList from './DemoBroadcastingList';
import fetchAllSupabaseRows from '../../utils/api/fetchAllSupabaseRows';
import SortControls from '../../components/table/SortControls';
import useListSort from '../../hook/useListSort';

const SORT_KEY_OPTIONS: Array<{ value: 'id' | 'order'; label: string }> = [
  { value: 'id', label: 'ID 기준' },
  { value: 'order', label: '순위 기준' },
];

const DemoBroadcastingLayout = () => {
  const navigate = useNavigate();
  const [broadcasting, setBroadcasting] = useState<Broadcasting[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedLang, setSelectedLang] = useState<LanguageCode>('all');
  const [programCounts, setProgramCounts] = useState<Record<number, number>>(
    {}
  );
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchableFilter, setSearchableFilter] = useState<StatusFilter>('all');

  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchProgramCounts = async () => {
      const data = await fetchAllSupabaseRows<{
        broadcasting_id: number;
        language: string | string[];
      }>({
        table: 'programs',
        select: 'broadcasting_id, language',
        orderColumn: 'broadcasting_id',
      });

      const counts: Record<number, number> = {};
      data.forEach((row) => {
        let langs: string[] = [];
        if (Array.isArray(row.language)) {
          langs = row.language;
        } else if (typeof row.language === 'string') {
          try {
            langs = JSON.parse(row.language);
          } catch {
            langs = [row.language];
          }
        }
        if (selectedLang === 'all' || langs.includes(selectedLang)) {
          counts[row.broadcasting_id] = (counts[row.broadcasting_id] || 0) + 1;
        }
      });
      setProgramCounts(counts);
    };
    fetchProgramCounts();
  }, [selectedLang]);

  const filteredBroadcasting = useMemo(() => {
    return broadcasting
      .filter((brod) => {
        if (selectedLang === 'all') return true;
        return parseLanguages(brod.language).includes(selectedLang);
      })
      .filter((brod) => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
          brod.title?.toLowerCase().includes(q) ||
          brod.channel?.toLowerCase().includes(q)
        );
      })
      .map((brod) => ({
        ...brod,
        programsCount: programCounts[brod.id] || 0,
      }));
  }, [broadcasting, selectedLang, searchQuery, programCounts]);

  const {
    sortKey,
    setSortKey,
    sortDirection,
    setSortDirection,
    sortedData: sortedBroadcasting,
  } = useListSort({
    data: filteredBroadcasting,
    sortOptions: SORT_KEY_OPTIONS,
    initialSortKey: 'id',
    initialSortDirection: 'asc',
    emptyLastOnAscKeys: ['order'],
  });

  const fetchBroadcasting = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchAllSupabaseRows<Broadcasting>({
        table: 'broadcastings',
        select: '*',
        orderColumn: 'id',
      });
      setBroadcasting(data);
    } catch (error) {
      setError((error as Error).message);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchBroadcasting();
  }, []);

  return (
    <DemoListLayout
      parentMenu='데모 콘텐츠 관리'
      childMenu='방송사 관리'
      count={sortedBroadcasting.length}
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
      searchPlaceholder='방송사명 또는 채널명을 입력하세요.'
      addLabel='방송사 추가'
      onAdd={() => navigate('/demo/broadcasting/new')}
    >
      <LoadingOverlay loading={loading}>
        방송사 목록을 불러오는 중입니다.
      </LoadingOverlay>

      {!loading && !error && (
        <DemoBroadcastingList
          broadcasting={sortedBroadcasting}
          selectedLang={selectedLang}
          onDeleted={fetchBroadcasting}
        />
      )}
    </DemoListLayout>
  );
};

export default DemoBroadcastingLayout;
