import Dropdown from '@/components/common/Dropdown';
import LoadingOverlay from '@/components/common/LoadingOverlay';
import DemoListLayout from '@/components/demo/DemoListLayout';
import SortControls from '@/components/table/SortControls';
import useDemoFilter from '@/hook/useDemoFilter';
import useListSort from '@/hook/useListSort';
import type { Series } from '@/types/pickleDemoContents';
import fetchAllSupabaseRows from '@/utils/api/fetchAllSupabaseRows';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DemoSeriesList from './DemoSeriesList';

const SORT_KEY_OPTIONS: Array<{ value: 'id' | 'order'; label: string }> = [
  { value: 'id', label: 'ID 기준' },
  { value: 'order', label: '순위 기준' },
];

const DemoSeriesLayout = () => {
  const navigate = useNavigate();
  const [series, setSeries] = useState<Series[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sections, setSections] = useState<{ id: number; title: string }[]>([]);
  const [selectedSection, setSelectedSection] = useState('all');
  const {
    filteredData,
    selectedLang,
    setSelectedLang,

    searchQuery,
    setSearchQuery,
  } = useDemoFilter(series);

  const fetchSeries = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchAllSupabaseRows<Series>({
        table: 'series',
        select: '*, sections(title)',
        orderColumn: 'id',
      });
      setSeries(data);
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSeries();
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

  const sectionFilteredData = filteredData.filter((item) =>
    selectedSection === 'all'
      ? true
      : item.section_id === Number(selectedSection)
  );

  const {
    sortKey,
    setSortKey,
    sortDirection,
    setSortDirection,
    sortedData: sortedSeries,
  } = useListSort({
    data: sectionFilteredData,
    sortOptions: SORT_KEY_OPTIONS,
    initialSortKey: 'id',
    initialSortDirection: 'asc',
    emptyLastOnAscKeys: ['order'],
  });

  return (
    <DemoListLayout
      parentMenu='데모 콘텐츠 관리'
      childMenu='시리즈 관리'
      count={sortedSeries.length}
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
      searchQuery={searchQuery}
      onSearchQueryChange={setSearchQuery}
      searchPlaceholder='시리즈명을 입력하세요.'
      addLabel='시리즈 추가'
      onAdd={() => navigate('/demo/series/new')}
    >
      <LoadingOverlay loading={loading}>
        시리즈 목록을 불러오는 중입니다.
      </LoadingOverlay>

      {!loading && !error && (
        <DemoSeriesList
          series={sortedSeries}
          selectedLang={selectedLang}
          onDeleted={fetchSeries}
        />
      )}
    </DemoListLayout>
  );
};

export default DemoSeriesLayout;
