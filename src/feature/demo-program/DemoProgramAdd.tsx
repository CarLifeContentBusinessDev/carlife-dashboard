import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import FormActionsButton from '../../components/FormActionButton';
import FormField from '../../components/FormField';
import FormLayout from '../../components/FormLayout';
import FormTabs from '../../components/FormTabs';
import { ThumbnailPreview } from '../../components/ThumbnailPreview';
import { supabase } from '../../lib/supabase';

const LANG_OPTIONS = [
  { code: 'ko', label: '한국' },
  { code: 'en', label: '북미' },
  { code: 'de', label: '독일' },
  { code: 'jp', label: '일본' },
] as const;

const LANGUAGE_TO_COUNTRY: Record<string, string> = {
  ko: 'KR',
  en: 'US',
  de: 'DE',
  jp: 'JP',
};

interface SelectOption {
  id: number;
  title: string;
}

const initialState = {
  title: '',
  subtitle: '',
  type: '',
  img_url: '',
  category_id: '',
  broadcasting_id: '',
  is_sequential: false,
  is_active: true,
  is_searchable: true,
  language: [] as string[],
};

const DemoProgramAdd = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialState);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [categories, setCategories] = useState<SelectOption[]>([]);
  const [broadcastings, setBroadcastings] = useState<SelectOption[]>([]);
  const [categoryQuery, setCategoryQuery] = useState('');
  const [isCategorySearchOpen, setIsCategorySearchOpen] = useState(false);
  const [broadcastingQuery, setBroadcastingQuery] = useState('');
  const [isBroadcastingSearchOpen, setIsBroadcastingSearchOpen] =
    useState(false);
  const [searchParams] = useSearchParams();
  const initLang = searchParams.get('lang') ?? 'ko';
  const [activeTab, setActiveTab] = useState(
    initLang === 'ko' ? 'basic' : 'localize'
  );

  const filteredCategories = categories
    .filter((category) => {
      const query = categoryQuery.trim().toLowerCase();
      if (!query) return true;

      return (
        String(category.id).includes(query) ||
        category.title.toLowerCase().includes(query)
      );
    })
    .slice(0, 30);

  const filteredBroadcastings = broadcastings
    .filter((broadcasting) => {
      const query = broadcastingQuery.trim().toLowerCase();
      if (!query) return true;

      return (
        String(broadcasting.id).includes(query) ||
        broadcasting.title.toLowerCase().includes(query)
      );
    })
    .slice(0, 30);

  const selectedCategory = categories.find(
    (category) => String(category.id) === form.category_id
  );
  const selectedBroadcasting = broadcastings.find(
    (broadcasting) => String(broadcasting.id) === form.broadcasting_id
  );

  useEffect(() => {
    const fetchOptions = async () => {
      const [{ data: categoryData }, { data: broadcastingData }] =
        await Promise.all([
          supabase.from('categories').select('id, title').order('id'),
          supabase.from('broadcastings').select('id, title').order('id'),
        ]);

      setCategories((categoryData ?? []) as SelectOption[]);
      setBroadcastings((broadcastingData ?? []) as SelectOption[]);
    };

    fetchOptions();
  }, []);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleToggleSequential = () => {
    setForm((prev) => ({
      ...prev,
      is_sequential: !prev.is_sequential,
    }));
  };

  const handleToggleActive = () => {
    setForm((prev) => ({
      ...prev,
      is_active: !prev.is_active,
    }));
  };

  const handleToggleSearchable = () => {
    setForm((prev) => ({
      ...prev,
      is_searchable: !prev.is_searchable,
    }));
  };

  const handleLangToggle = (lang: string) => {
    setForm((prev) => {
      const exists = prev.language.includes(lang);

      return {
        ...prev,
        language: exists
          ? prev.language.filter((l) => l !== lang)
          : [...prev.language, lang],
      };
    });
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      setError('프로그램 제목은 필수입니다.');
      return;
    }

    if (form.language.length === 0) {
      setError('최소 한 개 이상의 언어를 선택하세요.');
      return;
    }

    if (!form.category_id || !form.broadcasting_id) {
      setError('카테고리와 방송사를 선택하세요.');
      return;
    }

    const categoryId = Number(form.category_id);
    const broadcastingId = Number(form.broadcasting_id);

    if (!Number.isInteger(categoryId) || categoryId <= 0) {
      setError('카테고리 ID는 숫자로 입력하세요.');
      return;
    }

    if (!Number.isInteger(broadcastingId) || broadcastingId <= 0) {
      setError('방송사 ID는 숫자로 입력하세요.');
      return;
    }

    setSaving(true);
    setError('');

    const { data: insertedProgram, error } = await supabase
      .from('programs')
      .insert([
        {
          title: form.title,
          subtitle: form.subtitle || null,
          type: form.type || null,
          img_url: form.img_url || null,
          category_id: categoryId,
          broadcasting_id: broadcastingId,
          is_sequential: form.is_sequential,
          is_active: form.is_active,
          is_searchable: form.is_searchable,
          language: form.language,
        },
      ])
      .select('id')
      .single();

    if (!error && insertedProgram) {
      const categoryMappingRows = form.language.map((lang) => ({
        category_id: categoryId,
        program_id: insertedProgram.id,
        language: lang,
        country: LANGUAGE_TO_COUNTRY[lang] ?? lang.toUpperCase(),
        order: null,
      }));

      const { error: mappingError } = await supabase
        .from('programs_categories')
        .insert(categoryMappingRows);

      if (mappingError) {
        await supabase.from('programs').delete().eq('id', insertedProgram.id);
        setSaving(false);
        setError(`카테고리 매핑 저장 실패: ${mappingError.message}`);
        return;
      }
    }

    setSaving(false);

    if (error) setError(error.message);
    else navigate(-1);
  };

  return (
    <FormLayout title='프로그램 추가'>
      <div className='flex justify-between items-center mb-6'>
        {/* 탭 */}
        <FormTabs
          tabs={[{ key: 'basic', label: '기본 정보' }]}
          active={activeTab}
          onChange={setActiveTab}
        />

        {/* 버튼 */}
        <FormActionsButton
          saving={saving}
          error={error}
          onCancel={() => navigate(-1)}
          onSave={handleSave}
        />
      </div>

      <div className='flex flex-col gap-10 mb-10'>
        <FormField label='국가 선택'>
          <div className='flex gap-3 flex-wrap'>
            {LANG_OPTIONS.map((lang) => {
              const selected = form.language.includes(lang.code);

              return (
                <button
                  key={lang.code}
                  type='button'
                  onClick={() => handleLangToggle(lang.code)}
                  className={`px-4 h-10 rounded-full text-sm font-medium transition border
                      ${
                        selected
                          ? 'bg-gray-900 text-white border-gray-900'
                          : 'bg-white text-gray-600 border-gray-300 hover:border-gray-500'
                      }
                    `}
                >
                  {lang.label}
                </button>
              );
            })}
          </div>
        </FormField>

        <div className='flex gap-5'>
          <div className='flex gap-8 items-start'>
            <ThumbnailPreview url={form.img_url} title={form.title} />
          </div>

          <div className='flex flex-col gap-2 flex-1'>
            <FormField label='Title (필수)'>
              <input
                name='title'
                value={form.title}
                onChange={handleChange}
                className='w-full px-4 h-10 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900'
              />
            </FormField>
            <FormField label='Subtitle'>
              <input
                name='subtitle'
                value={form.subtitle}
                onChange={handleChange}
                className='w-full px-4 h-10 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900'
              />
            </FormField>

            <FormField label='Type'>
              <input
                name='type'
                value={form.type}
                onChange={handleChange}
                className='w-full px-4 h-10 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900'
              />
            </FormField>
          </div>
        </div>

        <div className='flex flex-col gap-5 flex-1'>
          <FormField label='Thumbnail URL'>
            <input
              name='img_url'
              value={form.img_url}
              onChange={handleChange}
              className='w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-gray-900'
            />
          </FormField>
        </div>

        <div className='grid grid-cols-2 gap-8'>
          <FormField label='카테고리'>
            <div className='flex flex-col gap-2'>
              <div className='flex gap-2'>
                <input
                  name='category_id'
                  value={form.category_id}
                  onChange={handleChange}
                  inputMode='numeric'
                  placeholder='카테고리 ID 직접 입력'
                  className='w-full px-4 h-10 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900'
                />
                <button
                  type='button'
                  onClick={() => setIsCategorySearchOpen((prev) => !prev)}
                  className='px-4 h-10 rounded-xl border border-gray-200 text-sm whitespace-nowrap bg-white hover:bg-gray-50'
                >
                  {isCategorySearchOpen ? '검색 닫기' : '검색해서 선택'}
                </button>
              </div>

              {selectedCategory && (
                <p className='text-xs text-gray-500'>
                  선택된 카테고리: #{selectedCategory.id}{' '}
                  {selectedCategory.title}
                </p>
              )}

              {isCategorySearchOpen && (
                <div className='rounded-xl border border-gray-200 p-3 bg-white'>
                  <input
                    value={categoryQuery}
                    onChange={(e) => setCategoryQuery(e.target.value)}
                    placeholder='ID 또는 제목으로 검색'
                    className='w-full px-3 h-10 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900'
                  />
                  <div className='mt-2 max-h-52 overflow-y-auto divide-y divide-gray-100 border border-gray-100 rounded-lg'>
                    {filteredCategories.length === 0 && (
                      <p className='px-3 py-2 text-sm text-gray-500'>
                        검색 결과가 없습니다.
                      </p>
                    )}
                    {filteredCategories.map((category) => (
                      <button
                        key={category.id}
                        type='button'
                        onClick={() => {
                          setForm((prev) => ({
                            ...prev,
                            category_id: String(category.id),
                          }));
                          setCategoryQuery(category.title);
                          setIsCategorySearchOpen(false);
                        }}
                        className='w-full text-left px-3 py-2 text-sm hover:bg-gray-50'
                      >
                        #{category.id} {category.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </FormField>

          <FormField label='방송사'>
            <div className='flex flex-col gap-2'>
              <div className='flex gap-2'>
                <input
                  name='broadcasting_id'
                  value={form.broadcasting_id}
                  onChange={handleChange}
                  inputMode='numeric'
                  placeholder='방송사 ID 직접 입력'
                  className='w-full px-4 h-10 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900'
                />
                <button
                  type='button'
                  onClick={() => setIsBroadcastingSearchOpen((prev) => !prev)}
                  className='px-4 h-10 rounded-xl border border-gray-200 text-sm whitespace-nowrap bg-white hover:bg-gray-50'
                >
                  {isBroadcastingSearchOpen ? '검색 닫기' : '검색해서 선택'}
                </button>
              </div>

              {selectedBroadcasting && (
                <p className='text-xs text-gray-500'>
                  선택된 방송사: #{selectedBroadcasting.id}{' '}
                  {selectedBroadcasting.title}
                </p>
              )}

              {isBroadcastingSearchOpen && (
                <div className='rounded-xl border border-gray-200 p-3 bg-white'>
                  <input
                    value={broadcastingQuery}
                    onChange={(e) => setBroadcastingQuery(e.target.value)}
                    placeholder='ID 또는 제목으로 검색'
                    className='w-full px-3 h-10 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900'
                  />
                  <div className='mt-2 max-h-52 overflow-y-auto divide-y divide-gray-100 border border-gray-100 rounded-lg'>
                    {filteredBroadcastings.length === 0 && (
                      <p className='px-3 py-2 text-sm text-gray-500'>
                        검색 결과가 없습니다.
                      </p>
                    )}
                    {filteredBroadcastings.map((broadcasting) => (
                      <button
                        key={broadcasting.id}
                        type='button'
                        onClick={() => {
                          setForm((prev) => ({
                            ...prev,
                            broadcasting_id: String(broadcasting.id),
                          }));
                          setBroadcastingQuery(broadcasting.title);
                          setIsBroadcastingSearchOpen(false);
                        }}
                        className='w-full text-left px-3 py-2 text-sm hover:bg-gray-50'
                      >
                        #{broadcasting.id} {broadcasting.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </FormField>
        </div>

        <div className='grid grid-cols-3 gap-8'>
          <FormField label='역순 재생'>
            <button
              type='button'
              onClick={handleToggleSequential}
              className={`w-fit px-4 h-10 rounded-full text-sm font-medium transition border ${
                form.is_sequential
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-gray-500'
              }`}
            >
              {form.is_sequential ? '사용' : '미사용'}
            </button>
          </FormField>

          <FormField label='공개 여부'>
            <button
              type='button'
              onClick={handleToggleActive}
              className={`w-fit px-4 h-10 rounded-full text-sm font-medium transition border ${
                form.is_active
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-gray-500'
              }`}
            >
              {form.is_active ? '공개' : '비공개'}
            </button>
          </FormField>

          <FormField label='검색 가능'>
            <button
              type='button'
              onClick={handleToggleSearchable}
              className={`w-fit px-4 h-10 rounded-full text-sm font-medium transition border ${
                form.is_searchable
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-gray-500'
              }`}
            >
              {form.is_searchable ? '가능' : '불가능'}
            </button>
          </FormField>
        </div>
      </div>

      {error && <div className='text-red-500 text-sm mt-4'>{error}</div>}
    </FormLayout>
  );
};

export default DemoProgramAdd;
