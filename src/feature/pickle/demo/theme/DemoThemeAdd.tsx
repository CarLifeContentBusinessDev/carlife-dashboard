import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import FormActionsButton from '@/components/form/FormActionButton';
import FormField from '@/components/form/FormField';
import FormLayout from '@/components/form/FormLayout';
import FormTabs from '@/components/form/FormTabs';
import { ThumbnailPreview } from '@/components/table/ThumbnailPreview';
import { supabase } from '@/lib/supabase';
import { LANG_OPTIONS } from '@/constants/languages';

interface SectionOption {
  id: number;
  title: string;
}

interface ProgramOption {
  id: number;
  title: string;
}

const initialState = {
  title: '',
  subtitle: '',
  img_url: '',
  section_id: '',
  order: '',
  language: [] as string[],
};

const DemoThemeAdd = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialState);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [sections, setSections] = useState<SectionOption[]>([]);
  const [programs, setPrograms] = useState<ProgramOption[]>([]);
  const [sectionQuery, setSectionQuery] = useState('');
  const [isSectionSearchOpen, setIsSectionSearchOpen] = useState(false);
  const [programIdsInput, setProgramIdsInput] = useState('');
  const [programQuery, setProgramQuery] = useState('');
  const [isProgramSearchOpen, setIsProgramSearchOpen] = useState(false);
  const [searchParams] = useSearchParams();
  const initLang = searchParams.get('lang') ?? 'ko';
  const [activeTab, setActiveTab] = useState(
    initLang === 'ko' ? 'basic' : 'localize'
  );

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

  const selectedSection = sections.find(
    (section) => String(section.id) === form.section_id
  );

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

  useEffect(() => {
    const fetchOptions = async () => {
      const [{ data: sectionData }, { data: programData }] = await Promise.all([
        supabase.from('sections').select('id, title').order('id'),
        supabase.from('programs').select('id, title').order('id'),
      ]);

      setSections((sectionData ?? []) as SectionOption[]);
      setPrograms((programData ?? []) as ProgramOption[]);
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
      setError('테마 제목은 필수입니다.');
      return;
    }

    if (!form.section_id) {
      setError('섹션을 선택하세요.');
      return;
    }

    if (form.language.length === 0) {
      setError('최소 한 개 이상의 국가를 선택하세요.');
      return;
    }

    const sectionId = Number(form.section_id);
    if (!Number.isInteger(sectionId) || sectionId <= 0) {
      setError('섹션 ID는 숫자로 입력하세요.');
      return;
    }

    if (mappedProgramIds.length === 0) {
      setError('매핑할 프로그램 ID를 하나 이상 입력하세요.');
      return;
    }

    const orderValue =
      form.order.trim() === '' ? null : Number(form.order.trim());
    if (orderValue != null && !Number.isFinite(orderValue)) {
      setError('Order는 숫자로 입력하세요.');
      return;
    }

    setSaving(true);
    setError('');

    const { data: insertedTheme, error: themeError } = await supabase
      .from('themes')
      .insert([
        {
          title: form.title,
          subtitle: form.subtitle || null,
          img_url: form.img_url || null,
          section_id: sectionId,
          order: orderValue,
          language: form.language,
        },
      ])
      .select('id')
      .single();

    if (themeError || !insertedTheme) {
      setSaving(false);
      setError(themeError?.message ?? '테마 저장에 실패했습니다.');
      return;
    }

    const mappingRows = mappedProgramIds.map((programId, index) => ({
      theme_id: insertedTheme.id,
      program_id: programId,
      order: index + 1,
    }));

    const { error: mappingError } = await supabase
      .from('themes_programs')
      .insert(mappingRows);

    setSaving(false);

    if (mappingError) setError(mappingError.message);
    else navigate(-1);
  };

  return (
    <FormLayout title='테마 추가'>
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
        <FormField label='국가 선택 *'>
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
            <FormField label='Title *'>
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

            <FormField label='섹션 *'>
              <div className='flex flex-col gap-2'>
                <div className='flex gap-2'>
                  <input
                    name='section_id'
                    value={form.section_id}
                    onChange={handleChange}
                    inputMode='numeric'
                    placeholder='섹션 ID 직접 입력'
                    className='w-full px-4 h-10 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900'
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
                    선택된 섹션: #{selectedSection.id} {selectedSection.title}
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
                            setForm((prev) => ({
                              ...prev,
                              section_id: String(section.id),
                            }));
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
          <FormField label='Order'>
            <input
              type='number'
              name='order'
              value={form.order}
              onChange={handleChange}
              className='w-full px-4 h-10 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900'
            />
          </FormField>
        </div>

        <FormField label='프로그램 매핑 *'>
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
    </FormLayout>
  );
};

export default DemoThemeAdd;
