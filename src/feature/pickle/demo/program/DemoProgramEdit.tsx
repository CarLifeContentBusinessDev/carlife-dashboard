import { useEffect, useState } from 'react';
import FormActionsButton from '@/components/form/FormActionButton';
import FormField from '@/components/form/FormField';
import FormLayout from '@/components/form/FormLayout';
import FormTabs from '@/components/form/FormTabs';
import { ThumbnailPreview } from '@/components/table/ThumbnailPreview';
import { supabase } from '@/lib/supabase';
import useDemoEdit from '@/hook/useDemoEdit';
import { LANG_OPTIONS, LANGUAGE_TO_COUNTRY } from '@/constants/languages';

interface ProgramForm {
  id: number;
  title: string;
  subtitle: string;
  type: string;
  img_url: string;
  category_id: number | null;
  broadcasting_id: number | null;
  language: string[];
  is_sequential: boolean;
  is_active: boolean;
  is_searchable: boolean;
}

interface SelectOption {
  id: number;
  title: string;
}

const DemoProgramEdit = () => {
  const [activeTab, setActiveTab] = useState('basic');
  const [categories, setCategories] = useState<SelectOption[]>([]);
  const [broadcastings, setBroadcastings] = useState<SelectOption[]>([]);
  const [categoryQuery, setCategoryQuery] = useState('');
  const [isCategorySearchOpen, setIsCategorySearchOpen] = useState(false);
  const [broadcastingQuery, setBroadcastingQuery] = useState('');
  const [isBroadcastingSearchOpen, setIsBroadcastingSearchOpen] =
    useState(false);

  const {
    data: program,
    setData: setProgram,
    loading,
    saving,
    setSaving,
    error,
    setError,
    handleChange,
    handleLangToggle,
    save,
    navigate,
  } = useDemoEdit<ProgramForm>({
    table: 'programs',
    numericFields: ['category_id', 'broadcasting_id'],
  });

  useEffect(() => {
    Promise.all([
      supabase.from('categories').select('id, title').order('id'),
      supabase.from('broadcastings').select('id, title').order('id'),
    ]).then(([categoryRes, broadcastingRes]) => {
      setCategories((categoryRes.data ?? []) as SelectOption[]);
      setBroadcastings((broadcastingRes.data ?? []) as SelectOption[]);
    });
  }, []);

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

  const selectedCategory =
    program == null
      ? undefined
      : categories.find((category) => category.id === program.category_id);

  const selectedBroadcasting =
    program == null
      ? undefined
      : broadcastings.find(
          (broadcasting) => broadcasting.id === program.broadcasting_id
        );

  const handleToggleSequential = () => {
    setProgram((prev) =>
      prev ? { ...prev, is_sequential: !prev.is_sequential } : prev
    );
  };

  const handleToggleActive = () => {
    setProgram((prev) =>
      prev ? { ...prev, is_active: !prev.is_active } : prev
    );
  };

  const handleToggleSearchable = () => {
    setProgram((prev) =>
      prev ? { ...prev, is_searchable: !prev.is_searchable } : prev
    );
  };

  const handleSave = async () => {
    if (!program) return;
    if (!program.title.trim()) {
      setError('프로그램 제목은 필수입니다.');
      return;
    }

    if (program.language.length === 0) {
      setError('최소 한 개 이상의 언어를 선택하세요.');
      return;
    }

    const ok = await save({
      title: program.title,
      subtitle: program.subtitle || null,
      type: program.type || null,
      img_url: program.img_url || null,
      category_id: program.category_id,
      broadcasting_id: program.broadcasting_id,
      language: program.language,
      is_sequential: program.is_sequential,
      is_active: program.is_active,
      is_searchable: program.is_searchable,
    });

    if (!ok) return;

    if (program.category_id != null) {
      setSaving(true);

      const categoryMappingRows = program.language.map((lang) => ({
        category_id: program.category_id,
        program_id: program.id,
        language: lang,
        country: LANGUAGE_TO_COUNTRY[lang] ?? lang.toUpperCase(),
        order: null,
      }));

      const { error: mappingError } = await supabase.rpc(
        'replace_programs_categories',
        {
          p_program_id: program.id,
          p_category_id: program.category_id,
          p_mappings: categoryMappingRows,
        }
      );

      setSaving(false);
      if (mappingError) {
        setError(`카테고리 매핑 갱신 실패: ${mappingError.message}`);
        return;
      }
    }

    navigate(-1);
  };

  if (loading)
    return (
      <div className='flex items-center justify-center h-screen'>
        <div className='flex flex-col items-center gap-3'>
          <div className='w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin' />
          <p className='text-sm text-gray-400'>불러오는 중...</p>
        </div>
      </div>
    );

  if (error && !program)
    return (
      <div className='flex items-center justify-center h-screen'>
        <div className='text-center'>
          <p className='text-red-500 font-medium'>{error}</p>
          <button
            onClick={() => navigate(-1)}
            className='mt-4 text-sm text-gray-500 underline'
          >
            돌아가기
          </button>
        </div>
      </div>
    );

  if (!program) return null;

  return (
    <FormLayout title='프로그램 편집' id={program.id}>
      {/* 탭 + 버튼 행 */}
      <div className='flex justify-between items-center flex-shrink-0 mb-6'>
        <FormTabs
          tabs={[{ key: 'basic', label: '기본 정보' }]}
          active={activeTab}
          onChange={setActiveTab}
        />

        <FormActionsButton
          saving={saving}
          error={error}
          onCancel={() => navigate(-1)}
          onSave={handleSave}
        />
      </div>

      {/* 탭 콘텐츠 */}
      <div className='flex-1'>
        {activeTab === 'basic' && (
          <div className='flex flex-col gap-6'>
            <div className='flex gap-5'>
              <ThumbnailPreview
                url={program.img_url || ''}
                title={program.title || ''}
              />
              <div className='flex flex-col gap-2 flex-1'>
                <FormField label='Title (필수)'>
                  <input
                    className='w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition'
                    name='title'
                    value={program.title || ''}
                    onChange={handleChange}
                    placeholder='title'
                  />
                </FormField>
                <FormField label='Subtitle'>
                  <input
                    className='w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition'
                    name='subtitle'
                    value={program.subtitle || ''}
                    onChange={handleChange}
                    placeholder='subtitle'
                  />
                </FormField>
                <FormField label='Type'>
                  <input
                    className='w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition'
                    name='type'
                    value={program.type || ''}
                    onChange={handleChange}
                    placeholder='type'
                  />
                </FormField>
              </div>
            </div>

            <FormField label='Thumbnail URL'>
              <input
                className='w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition font-mono'
                name='img_url'
                value={program.img_url || ''}
                onChange={handleChange}
                placeholder='https://...'
              />
            </FormField>

            <div className='grid grid-cols-2 gap-6'>
              <FormField label='카테고리 (필수)'>
                <div className='flex flex-col gap-2'>
                  <div className='flex gap-2'>
                    <input
                      className='w-full px-4 h-10 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900'
                      name='category_id'
                      value={program.category_id ?? ''}
                      onChange={handleChange}
                      inputMode='numeric'
                      placeholder='카테고리 ID 직접 입력'
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
                              setProgram((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      category_id: category.id,
                                    }
                                  : prev
                              );
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

              <FormField label='방송사 (필수)'>
                <div className='flex flex-col gap-2'>
                  <div className='flex gap-2'>
                    <input
                      className='w-full px-4 h-10 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900'
                      name='broadcasting_id'
                      value={program.broadcasting_id ?? ''}
                      onChange={handleChange}
                      inputMode='numeric'
                      placeholder='방송사 ID 직접 입력'
                    />
                    <button
                      type='button'
                      onClick={() =>
                        setIsBroadcastingSearchOpen((prev) => !prev)
                      }
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
                              setProgram((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      broadcasting_id: broadcasting.id,
                                    }
                                  : prev
                              );
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

            <div className='grid grid-cols-2 gap-6'>
              <FormField label='Language'>
                <div className='flex gap-3 flex-wrap'>
                  {LANG_OPTIONS.map((lang) => {
                    const selected = program.language.includes(lang.code);

                    return (
                      <button
                        key={lang.code}
                        type='button'
                        onClick={() => handleLangToggle(lang.code)}
                        className={`px-4 h-10 rounded-full text-sm font-medium transition border ${
                          selected
                            ? 'bg-gray-900 text-white border-gray-900'
                            : 'bg-white text-gray-600 border-gray-300 hover:border-gray-500'
                        }`}
                      >
                        {lang.label}
                      </button>
                    );
                  })}
                </div>
              </FormField>

              <FormField label='역순 재생'>
                <button
                  type='button'
                  onClick={handleToggleSequential}
                  className={`w-fit px-4 h-10 rounded-full text-sm font-medium transition border ${
                    program.is_sequential
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-gray-500'
                  }`}
                >
                  {program.is_sequential ? '사용' : '미사용'}
                </button>
              </FormField>

              <FormField label='공개 여부'>
                <button
                  type='button'
                  onClick={handleToggleActive}
                  className={`w-fit px-4 h-10 rounded-full text-sm font-medium transition border ${
                    program.is_active
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-gray-500'
                  }`}
                >
                  {program.is_active ? '공개' : '비공개'}
                </button>
              </FormField>

              <FormField label='검색 가능'>
                <button
                  type='button'
                  onClick={handleToggleSearchable}
                  className={`w-fit px-4 h-10 rounded-full text-sm font-medium transition border ${
                    program.is_searchable
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-gray-500'
                  }`}
                >
                  {program.is_searchable ? '가능' : '불가능'}
                </button>
              </FormField>
            </div>
          </div>
        )}
      </div>
    </FormLayout>
  );
};

export default DemoProgramEdit;
