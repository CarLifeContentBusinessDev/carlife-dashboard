import LoadingOverlay from '@/components/common/LoadingOverlay';
import DemoListLayout from '@/components/demo/DemoListLayout';
import SortControls from '@/components/table/SortControls';
import useDemoFilter from '@/hook/useDemoFilter';
import useListSort from '@/hook/useListSort';
import type { Episode } from '@/types/pickleDemoContents';
import fetchAllSupabaseRows from '@/utils/api/fetchAllSupabaseRows';
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
