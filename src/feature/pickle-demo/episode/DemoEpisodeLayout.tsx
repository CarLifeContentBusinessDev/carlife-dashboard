import LoadingOverlay from '@/shared/components/common/LoadingOverlay';
import DemoListLayout from '@/feature/pickle-demo/components/DemoListLayout';
import SortControls from '@/shared/components/table/SortControls';
import useDemoFilter from '@/feature/pickle-demo/hooks/useDemoFilter';
import useListSort from '@/shared/hooks/useListSort';
import type { Episode } from '@/shared/types/pickleDemoContents';
import fetchAllSupabaseRows from '@/shared/utils/api/fetchAllSupabaseRows';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DemoEpisodeList from './DemoEpisodeList';

const SORT_KEY_OPTIONS: Array<{ value: 'id'; label: string }> = [
  { value: 'id', label: 'ID 기준' },
];

const DemoEpisodeLayout = () => {
  const navigate = useNavigate();
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const {
    filteredData,
    selectedLang,
    setSelectedLang,
    statusFilter,
    setStatusFilter,
    searchableFilter,
    setSearchableFilter,
    searchQuery,
    setSearchQuery,
  } = useDemoFilter(episodes, {
    hasStatusFilter: true,
    hasSearchableFilter: true,
  });

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

  const {
    sortKey,
    setSortKey,
    sortDirection,
    setSortDirection,
    sortedData: sortedEpisodes,
  } = useListSort({
    data: filteredData,
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
      onAdd={() => navigate('/demo/episodes/new')}
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
