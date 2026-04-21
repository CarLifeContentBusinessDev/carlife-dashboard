import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LoadingOverlay from '../../components/common/LoadingOverlay';
import {
  LANGUAGES,
  LANG_COLUMN_MAP,
  type LanguageCode,
} from '../../constants/languages';
import DemoListLayout from '../../components/demo/DemoListLayout';
import SortControls from '../../components/table/SortControls';
import DemoCategoryList from './DemoCategoryList';
import fetchAllSupabaseRows from '../../utils/api/fetchAllSupabaseRows';
import useListSort from '../../hook/useListSort';

const SORT_KEY_OPTIONS: Array<{ value: 'id' | 'order'; label: string }> = [
  { value: 'id', label: 'ID 기준' },
  { value: 'order', label: '순위 기준' },
];

const CATEGORY_LANGUAGE_OPTIONS = LANGUAGES.filter(
  (lang) => lang.value !== 'all'
);

interface Category {
  id: number;
  title: string;
  [key: string]: any;
}

const DemoCategoryLayout = () => {
  const navigate = useNavigate();

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedLang, setSelectedLang] = useState<LanguageCode>('ko');
  const [programCounts, setProgramCounts] = useState<Record<number, number>>(
    {}
  );
  const [searchQuery, setSearchQuery] = useState('');

  // 언어별로 보여줄 컬럼명 매핑 (공통 상수 사용)
  const langColumnMap = LANG_COLUMN_MAP;

  // programs 테이블에서 category_id별 프로그램 수 조회
  useEffect(() => {
    const fetchProgramCounts = async () => {
      const data = await fetchAllSupabaseRows<{
        category_id: number;
        language: string | string[];
      }>({
        table: 'programs',
        select: 'category_id, language',
        orderColumn: 'category_id',
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
          counts[row.category_id] = (counts[row.category_id] || 0) + 1;
        }
      });
      setProgramCounts(counts);
    };
    fetchProgramCounts();
  }, [selectedLang]);

  // 필터링된 데이터 생성
  const filteredCategories = categories
    .map((cat) => ({
      id: cat.id,
      title: cat[langColumnMap[selectedLang].title],
      img_url: cat[langColumnMap[selectedLang].img_url],
      order: cat.order,
      created_at: cat.created_at,
      language: cat.language,
      programsCount: programCounts[cat.id] || 0,
    }))
    .filter((cat) => {
      if (!searchQuery) return true;
      return cat.title?.toLowerCase().includes(searchQuery.toLowerCase());
    });

  const {
    sortKey,
    setSortKey,
    sortDirection,
    setSortDirection,
    sortedData: sortedCategories,
  } = useListSort({
    data: filteredCategories,
    sortOptions: SORT_KEY_OPTIONS,
    initialSortKey: 'id',
    initialSortDirection: 'asc',
    emptyLastOnAscKeys: ['order'],
  });

  const fetchCategories = async () => {
    setLoading(true);
    setError('');

    try {
      const data = await fetchAllSupabaseRows<Category>({
        table: 'categories',
        select: '*',
        orderColumn: 'order',
      });
      setCategories(data);
    } catch (error) {
      setError((error as Error).message);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  return (
    <DemoListLayout
      parentMenu='데모 콘텐츠 관리'
      childMenu='카테고리 관리'
      count={sortedCategories.length}
      selectedLang={selectedLang}
      onLangChange={setSelectedLang}
      languageOptions={CATEGORY_LANGUAGE_OPTIONS}
      extraControls={
        <SortControls
          sortKey={sortKey}
          sortOptions={SORT_KEY_OPTIONS}
          onSortKeyChange={setSortKey}
          sortDirection={sortDirection}
          onSortDirectionChange={setSortDirection}
        />
      }
      searchQuery={searchQuery}
      onSearchQueryChange={setSearchQuery}
      searchPlaceholder='카테고리명을 입력하세요.'
      addLabel='카테고리 추가'
      onAdd={() => navigate('/demo/category/new')}
    >
      <LoadingOverlay loading={loading}>
        카테고리 목록을 불러오는 중입니다.
      </LoadingOverlay>

      {!loading && !error && (
        <DemoCategoryList
          categories={sortedCategories}
          selectedLang={selectedLang}
          onDeleted={fetchCategories}
        />
      )}
    </DemoListLayout>
  );
};

export default DemoCategoryLayout;
