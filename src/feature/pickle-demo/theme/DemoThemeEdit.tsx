import { useEffect, useState } from 'react';
import FormActionsButton from '@/shared/components/form/FormActionButton';
import FormField from '@/shared/components/form/FormField';
import FormLayout from '@/shared/components/form/FormLayout';
import FormTabs from '@/shared/components/form/FormTabs';
import { ThumbnailPreview } from '@/shared/components/table/ThumbnailPreview';
import { supabase } from '@/lib/supabase';
import useDemoEdit from '@/feature/pickle-demo/hooks/useDemoEdit';
import { LANG_OPTIONS } from '@/constants/languages';

interface ThemeForm {
  id: number;
  title: string;
  subtitle: string;
  img_url: string;
  section_id: number | null;
  order: number | null;
  language: string[];
}

interface SectionOption {
  id: number;
  title: string;
}

interface ProgramOption {
  id: number;
  title: string;
}

interface ThemeProgramMapRow {
  program_id: number;
  order: number | null;
}

const DemoThemeEdit = () => {
  const [activeTab, setActiveTab] = useState('basic');
  const [sections, setSections] = useState<SectionOption[]>([]);
  const [programs, setPrograms] = useState<ProgramOption[]>([]);
  const [sectionQuery, setSectionQuery] = useState('');
  const [isSectionSearchOpen, setIsSectionSearchOpen] = useState(false);
  const [programIdsInput, setProgramIdsInput] = useState('');
  const [programQuery, setProgramQuery] = useState('');
  const [isProgramSearchOpen, setIsProgramSearchOpen] = useState(false);

  const {
    data: theme,
    setData: setTheme,
    loading,
    saving,
    setSaving,
    error,
    setError,
    handleChange,
    handleLangToggle,
    save,
    navigate,
  } = useDemoEdit<ThemeForm>({
    table: 'themes',
    numericFields: ['section_id', 'order'],
  });

  useEffect(() => {
    Promise.all([
      supabase.from('sections').select('id, title').order('id'),
      supabase.from('programs').select('id, title').order('id'),
    ]).then(([sectionRes, programRes]) => {
      setSections((sectionRes.data ?? []) as SectionOption[]);
      setPrograms((programRes.data ?? []) as ProgramOption[]);
    });
  }, []);

  useEffect(() => {
    if (!theme) return;
    supabase
      .from('themes_programs')
      .select('program_id, order')
      .eq('theme_id', theme.id)
      .order('order', { ascending: true })
      .then(({ data }) => {
        const mappingRows = (data ?? []) as ThemeProgramMapRow[];
        const mappedIds = mappingRows
          .map((row) => Number(row.program_id))
          .filter((v) => Number.isInteger(v) && v > 0);
        setProgramIdsInput(Array.from(new Set(mappedIds)).join(','));
      });
  }, [theme?.id]);

  const filteredSections = sections
    .filter((section) => {
      const query = sectionQuery.trim().toLowerCase();
      if (!query) return true;

      return (
        String(section.id).includes(query) ||
        section.title.toLowerCase().includes(query)
      );
    })
    .slice(0, 30);

  const selectedSection =
    theme == null
      ? undefined
      : sections.find((section) => section.id === theme.section_id);

  const parseIdCsv = (value: string) =>
    Array.from(
      new Set(
        value
          .split(',')
          .map((v) => Number(v.trim()))
          .filter((v) => Number.isInteger(v) && v > 0)
      )
    );

  const mappedProgramIds = parseIdCsv(programIdsInput);

  const filteredPrograms = programs
    .filter((program) => {
      const query = programQuery.trim().toLowerCase();
      if (!query) return true;

      return (
        String(program.id).includes(query) ||
        program.title.toLowerCase().includes(query)
      );
    })
    .slice(0, 30);

  const handleSave = async () => {
    if (!theme) return;
    if (!theme.title.trim()) {
      setError('테마 제목은 필수입니다.');
      return;
    }

    if (!theme.section_id) {
      setError('섹션을 선택하세요.');
      return;
    }

    if (!Number.isInteger(theme.section_id) || theme.section_id <= 0) {
      setError('섹션 ID는 숫자로 입력하세요.');
      return;
    }

    if (mappedProgramIds.length === 0) {
      setError('매핑할 프로그램 ID를 하나 이상 입력하세요.');
      return;
    }

    if (theme.order != null && !Number.isFinite(theme.order)) {
      setError('Order는 숫자로 입력하세요.');
      return;
    }

    const ok = await save({
      title: theme.title,
      subtitle: theme.subtitle || null,
      img_url: theme.img_url || null,
      section_id: theme.section_id,
      order: theme.order,
      language: theme.language,
    });

    if (!ok) return;

    setSaving(true);

    const { error: deleteMappingError } = await supabase
      .from('themes_programs')
      .delete()
      .eq('theme_id', theme.id);

    if (deleteMappingError) {
      setSaving(false);
      setError(`매핑 갱신에 실패했습니다: ${deleteMappingError.message}`);
      return;
    }

    const mappingRows = mappedProgramIds.map((programId, index) => ({
      theme_id: theme.id,
      program_id: programId,
      order: index + 1,
    }));

    const { error: insertMappingError } = await supabase
      .from('themes_programs')
      .insert(mappingRows);

    setSaving(false);
    if (insertMappingError) {
      setError(`매핑 갱신에 실패했습니다: ${insertMappingError.message}`);
      return;
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

  if (error)
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

  if (!theme) return null;

  return (
    <FormLayout title='테마 편집' id={theme.id}>
      {/* 탭 + 버튼 행 */}
      <div className='flex justify-between items-center shrink-0 mb-6'>
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
                url={theme.img_url || ''}
                title={theme.title || ''}
              />
              <div className='flex flex-col gap-2 flex-1'>
                <FormField label='Title (필수)'>
                  <input
                    className='w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition'
                    name='title'
                    value={theme.title || ''}
                    onChange={handleChange}
                    placeholder='title'
                  />
                </FormField>
                <FormField label='Subtitle'>
                  <input
                    className='w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition'
                    name='subtitle'
                    value={theme.subtitle || ''}
                    onChange={handleChange}
                    placeholder='subtitle'
                  />
                </FormField>
                <FormField label='섹션 (필수)'>
                  <div className='flex flex-col gap-2'>
                    <div className='flex gap-2'>
                      <input
                        className='w-full px-4 h-10 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900'
                        name='section_id'
                        value={theme.section_id ?? ''}
                        onChange={handleChange}
                        inputMode='numeric'
                        placeholder='섹션 ID 직접 입력'
                      />
                      <button
                        type='button'
                        onClick={() => setIsSectionSearchOpen((prev) => !prev)}
                        className='px-4 h-10 rounded-xl border border-gray-200 text-sm whitespace-nowrap bg-white hover:bg-gray-50'
                      >
                        {isSectionSearchOpen ? '검색 닫기' : '검색해서 선택'}
                      </button>
                    </div>

                    {selectedSection && (
                      <p className='text-xs text-gray-500'>
                        선택된 섹션: #{selectedSection.id}{' '}
                        {selectedSection.title}
                      </p>
                    )}

                    {isSectionSearchOpen && (
                      <div className='rounded-xl border border-gray-200 p-3 bg-white'>
                        <input
                          value={sectionQuery}
                          onChange={(e) => setSectionQuery(e.target.value)}
                          placeholder='ID 또는 제목으로 검색'
                          className='w-full px-3 h-10 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900'
                        />
                        <div className='mt-2 max-h-52 overflow-y-auto divide-y divide-gray-100 border border-gray-100 rounded-lg'>
                          {filteredSections.length === 0 && (
                            <p className='px-3 py-2 text-sm text-gray-500'>
                              검색 결과가 없습니다.
                            </p>
                          )}
                          {filteredSections.map((section) => (
                            <button
                              key={section.id}
                              type='button'
                              onClick={() => {
                                setTheme((prev) =>
                                  prev
                                    ? {
                                        ...prev,
                                        section_id: section.id,
                                      }
                                    : prev
                                );
                                setSectionQuery(section.title);
                                setIsSectionSearchOpen(false);
                              }}
                              className='w-full text-left px-3 py-2 text-sm hover:bg-gray-50'
                            >
                              #{section.id} {section.title}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </FormField>
              </div>
            </div>

            <FormField label='Thumbnail URL'>
              <input
                className='w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition font-mono'
                name='img_url'
                value={theme.img_url || ''}
                onChange={handleChange}
                placeholder='https://...'
              />
            </FormField>

            <div className='grid grid-cols-2 gap-6'>
              <FormField label='Order'>
                <input
                  className='w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition'
                  name='order'
                  type='number'
                  value={theme.order ?? ''}
                  onChange={handleChange}
                  placeholder='비워두면 NULL'
                />
              </FormField>

              <FormField label='Language'>
                <div className='flex gap-3 flex-wrap'>
                  {LANG_OPTIONS.map((lang) => {
                    const selected = theme.language.includes(lang.code);

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
            </div>

            <FormField label='프로그램 매핑 (필수)'>
              <div className='rounded-xl border border-gray-200 overflow-hidden'>
                <div className='flex gap-2 p-2 bg-gray-50'>
                  <input
                    value={programIdsInput}
                    onChange={(e) => setProgramIdsInput(e.target.value)}
                    placeholder='프로그램 ID를 쉼표로 입력 (예: 10,11,12)'
                    className='w-full px-3 h-9 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-gray-900'
                  />
                  <button
                    type='button'
                    onClick={() => {
                      setProgramQuery('');
                      setIsProgramSearchOpen(true);
                    }}
                    className='px-3 h-9 rounded-lg border border-gray-200 text-sm whitespace-nowrap bg-white hover:bg-gray-100 shrink-0'
                  >
                    검색해서 추가
                  </button>
                </div>

                {mappedProgramIds.length === 0 ? (
                  <p className='px-4 py-3 text-xs text-gray-400'>
                    선택된 프로그램이 없습니다.
                  </p>
                ) : (
                  <div className='divide-y divide-gray-100'>
                    {mappedProgramIds.map((id) => {
                      const program = programs.find((p) => p.id === id);
                      return (
                        <div
                          key={id}
                          className='flex items-center justify-between px-4 py-2.5 bg-white hover:bg-gray-50'
                        >
                          <span className='text-sm text-gray-700'>
                            <span className='text-gray-400 mr-1'>#{id}</span>
                            {program?.title ?? '(제목 없음)'}
                          </span>
                          <button
                            type='button'
                            onClick={() => {
                              const next = mappedProgramIds.filter(
                                (v) => v !== id
                              );
                              setProgramIdsInput(next.join(','));
                            }}
                            className='ml-2 text-gray-400 hover:text-red-500 text-xs shrink-0'
                          >
                            ×
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </FormField>
          </div>
        )}
      </div>

      {isProgramSearchOpen && (
        <div
          className='fixed inset-0 z-50 flex items-center justify-center bg-black/40'
          onClick={() => setIsProgramSearchOpen(false)}
        >
          <div
            className='bg-white rounded-2xl shadow-xl w-full max-w-3xl mx-4 flex flex-col max-h-[80vh]'
            onClick={(e) => e.stopPropagation()}
          >
            <div className='flex items-center justify-between px-5 py-4 border-b border-gray-100'>
              <h3 className='text-sm font-semibold text-gray-900'>
                프로그램 검색
              </h3>
              <button
                type='button'
                onClick={() => setIsProgramSearchOpen(false)}
                className='text-gray-400 hover:text-gray-600 text-lg leading-none'
              >
                ×
              </button>
            </div>

            <div className='px-5 pt-4 pb-2'>
              <input
                autoFocus
                value={programQuery}
                onChange={(e) => setProgramQuery(e.target.value)}
                placeholder='ID 또는 제목으로 검색'
                className='w-full px-3 h-10 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900'
              />
            </div>

            <div className='flex-1 overflow-y-auto divide-y divide-gray-100 px-5 pb-2'>
              {filteredPrograms.length === 0 && (
                <p className='py-4 text-sm text-gray-400 text-center'>
                  검색 결과가 없습니다.
                </p>
              )}
              {filteredPrograms.map((program) => {
                const isSelected = mappedProgramIds.includes(program.id);
                return (
                  <button
                    key={program.id}
                    type='button'
                    onClick={() => {
                      const next = isSelected
                        ? mappedProgramIds.filter((v) => v !== program.id)
                        : Array.from(
                            new Set([...mappedProgramIds, program.id])
                          );
                      setProgramIdsInput(next.join(','));
                    }}
                    className={`w-full flex items-center justify-between py-2.5 text-sm text-left transition ${
                      isSelected
                        ? 'text-gray-900 font-medium'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <span>
                      <span className='text-gray-400 mr-1'>#{program.id}</span>
                      {program.title}
                    </span>
                    {isSelected ? (
                      <span className='text-xs text-blue-500 shrink-0 ml-2'>
                        선택됨
                      </span>
                    ) : (
                      <span className='text-xs text-gray-400 shrink-0 ml-2'>
                        + 추가
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className='px-5 py-4 border-t border-gray-100'>
              <button
                type='button'
                onClick={() => setIsProgramSearchOpen(false)}
                className='w-full h-10 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-700 transition'
              >
                완료 ({mappedProgramIds.length}개 선택됨)
              </button>
            </div>
          </div>
        </div>
      )}
    </FormLayout>
  );
};

export default DemoThemeEdit;
