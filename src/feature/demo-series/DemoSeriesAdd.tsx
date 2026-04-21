import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import FormActionsButton from '../../components/form/FormActionButton';
import FormField from '../../components/form/FormField';
import FormLayout from '../../components/form/FormLayout';
import FormTabs from '../../components/form/FormTabs';
import { ThumbnailPreview } from '../../components/table/ThumbnailPreview';
import { supabase } from '../../lib/supabase';

const LANG_OPTIONS = [
  { code: 'ko', label: '한국' },
  { code: 'en', label: '북미' },
  { code: 'de', label: '독일' },
  { code: 'jp', label: '일본' },
] as const;

interface SectionOption {
  id: number;
  title: string;
}

interface EpisodeOption {
  id: number;
  title: string;
}

const initialState = {
  title: '',
  subtitle: '',
  img_url: '',
  section_id: '',
  order: '',
  oem_key: '',
  language: [] as string[],
};

const DemoSeriesAdd = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialState);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [sections, setSections] = useState<SectionOption[]>([]);
  const [episodes, setEpisodes] = useState<EpisodeOption[]>([]);
  const [sectionQuery, setSectionQuery] = useState('');
  const [isSectionSearchOpen, setIsSectionSearchOpen] = useState(false);
  const [episodeIdsInput, setEpisodeIdsInput] = useState('');
  const [episodeQuery, setEpisodeQuery] = useState('');
  const [isEpisodeSearchOpen, setIsEpisodeSearchOpen] = useState(false);
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

  const mappedEpisodeIds = parseIdCsv(episodeIdsInput);

  const filteredEpisodes = episodes
    .filter((episode) => {
      const query = episodeQuery.trim().toLowerCase();
      if (!query) return true;

      return (
        String(episode.id).includes(query) ||
        episode.title.toLowerCase().includes(query)
      );
    })
    .slice(0, 30);

  useEffect(() => {
    const fetchOptions = async () => {
      const [{ data: sectionData }, { data: episodeData }] = await Promise.all([
        supabase.from('sections').select('id, title').order('id'),
        supabase.from('episodes').select('id, title').order('id'),
      ]);

      setSections((sectionData ?? []) as SectionOption[]);
      setEpisodes((episodeData ?? []) as EpisodeOption[]);
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
      setError('시리즈 제목은 필수입니다.');
      return;
    }

    if (!form.section_id) {
      setError('섹션을 선택하세요.');
      return;
    }

    if (form.language.length === 0) {
      setError('최소 한 개 이상의 언어를 선택하세요.');
      return;
    }

    const sectionId = Number(form.section_id);
    if (!Number.isInteger(sectionId) || sectionId <= 0) {
      setError('섹션 ID는 숫자로 입력하세요.');
      return;
    }

    if (mappedEpisodeIds.length === 0) {
      setError('매핑할 에피소드 ID를 하나 이상 입력하세요.');
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

    const { data: insertedSeries, error: seriesError } = await supabase
      .from('series')
      .insert([
        {
          title: form.title,
          subtitle: form.subtitle || null,
          img_url: form.img_url || null,
          section_id: sectionId,
          order: orderValue,
          oem_key: form.oem_key || null,
          language: form.language,
        },
      ])
      .select('id')
      .single();

    if (seriesError || !insertedSeries) {
      setSaving(false);
      setError(seriesError?.message ?? '시리즈 저장에 실패했습니다.');
      return;
    }

    const mappingRows = mappedEpisodeIds.map((episodeId, index) => ({
      series_id: insertedSeries.id,
      episode_id: episodeId,
      order: index + 1,
    }));

    const { error: mappingError } = await supabase
      .from('series_episodes')
      .insert(mappingRows);

    setSaving(false);

    if (mappingError) setError(mappingError.message);
    else navigate(-1);
  };

  return (
    <FormLayout title='시리즈 추가'>
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

            <FormField label='섹션 (필수)'>
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

          <FormField label='OEM Key'>
            <input
              name='oem_key'
              value={form.oem_key}
              onChange={handleChange}
              className='w-full px-4 h-10 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900'
            />
          </FormField>
        </div>

        <FormField label='에피소드 매핑 (필수)'>
          <div className='flex flex-col gap-2'>
            <div className='flex gap-2'>
              <input
                value={episodeIdsInput}
                onChange={(e) => setEpisodeIdsInput(e.target.value)}
                placeholder='에피소드 ID를 쉼표로 입력 (예: 1,2,3)'
                className='w-full px-4 h-10 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900'
              />
              <button
                type='button'
                onClick={() => setIsEpisodeSearchOpen((prev) => !prev)}
                className='px-4 h-10 rounded-xl border border-gray-200 text-sm whitespace-nowrap bg-white hover:bg-gray-50'
              >
                {isEpisodeSearchOpen ? '검색 닫기' : '검색해서 추가'}
              </button>
            </div>

            {mappedEpisodeIds.length > 0 && (
              <p className='text-xs text-gray-500'>
                선택된 에피소드 ID: {mappedEpisodeIds.join(', ')}
              </p>
            )}

            {isEpisodeSearchOpen && (
              <div className='rounded-xl border border-gray-200 p-3 bg-white'>
                <input
                  value={episodeQuery}
                  onChange={(e) => setEpisodeQuery(e.target.value)}
                  placeholder='ID 또는 제목으로 검색'
                  className='w-full px-3 h-10 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900'
                />
                <div className='mt-2 max-h-52 overflow-y-auto divide-y divide-gray-100 border border-gray-100 rounded-lg'>
                  {filteredEpisodes.length === 0 && (
                    <p className='px-3 py-2 text-sm text-gray-500'>
                      검색 결과가 없습니다.
                    </p>
                  )}
                  {filteredEpisodes.map((episode) => (
                    <button
                      key={episode.id}
                      type='button'
                      onClick={() => {
                        const next = Array.from(
                          new Set([...mappedEpisodeIds, episode.id])
                        );
                        setEpisodeIdsInput(next.join(','));
                      }}
                      className='w-full text-left px-3 py-2 text-sm hover:bg-gray-50'
                    >
                      #{episode.id} {episode.title}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </FormField>
      </div>

      {error && <div className='text-red-500 text-sm mt-4'>{error}</div>}
    </FormLayout>
  );
};

export default DemoSeriesAdd;
