import { useEffect, useState } from 'react';
import FormActionsButton from '@/components/form/FormActionButton';
import FormField from '@/components/form/FormField';
import FormLayout from '@/components/form/FormLayout';
import FormTabs from '@/components/form/FormTabs';
import { ThumbnailPreview } from '@/components/table/ThumbnailPreview';
import { supabase } from '@/lib/supabase';
import useDemoEdit from '@/hook/useDemoEdit';

const LANG_OPTIONS = [
  { code: 'ko', label: '한국' },
  { code: 'en', label: '북미' },
  { code: 'de', label: '독일' },
  { code: 'jp', label: '일본' },
] as const;

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
              <div className='flex flex-col gap-2'>
                <div className='flex gap-2'>
                  <input
                    value={programIdsInput}
                    onChange={(e) => setProgramIdsInput(e.target.value)}
                    placeholder='프로그램 ID를 쉼표로 입력 (예: 10,11,12)'
                    className='w-full px-4 h-10 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900'
                  />
                  <button
                    type='button'
                    onClick={() => setIsProgramSearchOpen((prev) => !prev)}
                    className='px-4 h-10 rounded-xl border border-gray-200 text-sm whitespace-nowrap bg-white hover:bg-gray-50'
                  >
                    {isProgramSearchOpen ? '검색 닫기' : '검색해서 추가'}
                  </button>
                </div>

                {mappedProgramIds.length > 0 && (
                  <p className='text-xs text-gray-500'>
                    선택된 프로그램 ID: {mappedProgramIds.join(', ')}
                  </p>
                )}

                {isProgramSearchOpen && (
                  <div className='rounded-xl border border-gray-200 p-3 bg-white'>
                    <input
                      value={programQuery}
                      onChange={(e) => setProgramQuery(e.target.value)}
                      placeholder='ID 또는 제목으로 검색'
                      className='w-full px-3 h-10 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900'
                    />
                    <div className='mt-2 max-h-52 overflow-y-auto divide-y divide-gray-100 border border-gray-100 rounded-lg'>
                      {filteredPrograms.length === 0 && (
                        <p className='px-3 py-2 text-sm text-gray-500'>
                          검색 결과가 없습니다.
                        </p>
                      )}
                      {filteredPrograms.map((program) => (
                        <button
                          key={program.id}
                          type='button'
                          onClick={() => {
                            const next = Array.from(
                              new Set([...mappedProgramIds, program.id])
                            );
                            setProgramIdsInput(next.join(','));
                          }}
                          className='w-full text-left px-3 py-2 text-sm hover:bg-gray-50'
                        >
                          #{program.id} {program.title}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </FormField>
          </div>
        )}
      </div>
    </FormLayout>
  );
};

export default DemoThemeEdit;
