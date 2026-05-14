import { useEffect, useState } from 'react';
import DemoListLayout, {
  type StatusFilter,
} from '@/components/demo/DemoListLayout';
import LoadingOverlay from '@/components/common/LoadingOverlay';
import { type LanguageCode } from '@/constants/languages';
import { useNavigate } from 'react-router-dom';
import SortControls from '@/components/table/SortControls';
import type { Episode } from '@/types/pickleDemoContents';
import useListSort from '@/hook/useListSort';
import parseLanguages from '@/utils/format/parseLanguages';
import DemoEpisodeList from './DemoEpisodeList';
import fetchAllSupabaseRows from '@/utils/api/fetchAllSupabaseRows';

const SORT_KEY_OPTIONS: Array<{ value: 'id'; label: string }> = [
  { value: 'id', label: 'ID 기준' },
];

const DemoEpisodeLayout = () => {
  const navigate = useNavigate();
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedLang, setSelectedLang] = useState<LanguageCode>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchableFilter, setSearchableFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchEpisodes = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchAllSupabaseRows<Episode>({
        table: 'episodes',
        select: '*, programs(title)',
        orderColumn: 'id',
      });
      setEpisodes(data);
    } catch (error) {
      setError((error as Error).message);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchEpisodes();
  }, []);

  const filteredEpisodes = episodes
    .filter((ep) => {
      if (selectedLang === 'all') return true;
      const langs = parseLanguages(ep.language);
      return langs.includes(selectedLang);
    })
    .filter((ep) => {
      if (statusFilter === 'all') return true;
      return statusFilter === 'active' ? ep.is_active : !ep.is_active;
    })
    .filter((ep) => {
      if (searchableFilter === 'all') return true;
      return searchableFilter === 'active'
        ? ep.is_searchable
        : !ep.is_searchable;
    })
    .filter((ep) => {
      if (!searchQuery) return true;
      return ep.title?.toLowerCase().includes(searchQuery.toLowerCase());
    });

  const {
    sortKey,
    setSortKey,
    sortDirection,
    setSortDirection,
    sortedData: sortedEpisodes,
  } = useListSort({
    data: filteredEpisodes,
    sortOptions: SORT_KEY_OPTIONS,
    initialSortKey: 'id',
    initialSortDirection: 'asc',
  });

  return (
    <DemoListLayout
      parentMenu='데모 콘텐츠 관리'
      childMenu='에피소드 관리'
      count={sortedEpisodes.length}
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
      searchPlaceholder='에피소드명을 입력하세요.'
      addLabel='에피소드 추가'
      onAdd={() => navigate('/demo/episode/new')}
    >
      <LoadingOverlay loading={loading}>
        에피소드 목록을 불러오는 중입니다.
      </LoadingOverlay>

      {!loading && !error && (
        <DemoEpisodeList
          episodes={sortedEpisodes}
          selectedLang={selectedLang}
          onDeleted={fetchEpisodes}
        />
      )}
    </DemoListLayout>
  );
};

export default DemoEpisodeLayout;
