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

interface SeriesForm {
  id: number;
  title: string;
  subtitle: string;
  img_url: string;
  section_id: number | null;
  order: number | null;
  oem_key: string;
  language: string[];
}

interface SectionOption {
  id: number;
  title: string;
}

interface EpisodeOption {
  id: number;
  title: string;
}

interface SeriesEpisodeMapRow {
  episode_id: number;
  order: number | null;
}

const DemoSeriesEdit = () => {
  const [activeTab, setActiveTab] = useState('basic');
  const [sections, setSections] = useState<SectionOption[]>([]);
  const [episodes, setEpisodes] = useState<EpisodeOption[]>([]);
  const [sectionQuery, setSectionQuery] = useState('');
  const [isSectionSearchOpen, setIsSectionSearchOpen] = useState(false);
  const [episodeIdsInput, setEpisodeIdsInput] = useState('');
  const [episodeQuery, setEpisodeQuery] = useState('');
  const [isEpisodeSearchOpen, setIsEpisodeSearchOpen] = useState(false);

  const {
    data: series,
    setData: setSeries,
    loading,
    saving,
    setSaving,
    error,
    setError,
    handleChange,
    handleLangToggle,
    save,
    navigate,
  } = useDemoEdit<SeriesForm>({
    table: 'series',
    numericFields: ['section_id', 'order'],
  });

  useEffect(() => {
    Promise.all([
      supabase.from('sections').select('id, title').order('id'),
      supabase.from('episodes').select('id, title').order('id'),
    ]).then(([sectionRes, episodeRes]) => {
      setSections((sectionRes.data ?? []) as SectionOption[]);
      setEpisodes((episodeRes.data ?? []) as EpisodeOption[]);
    });
  }, []);

  useEffect(() => {
    if (!series) return;
    supabase
      .from('series_episodes')
      .select('episode_id, order')
      .eq('series_id', series.id)
      .order('order', { ascending: true })
      .then(({ data }) => {
        const mappingRows = (data ?? []) as SeriesEpisodeMapRow[];
        const mappedIds = mappingRows
          .map((row) => Number(row.episode_id))
          .filter((v) => Number.isInteger(v) && v > 0);
        setEpisodeIdsInput(Array.from(new Set(mappedIds)).join(','));
      });
  }, [series?.id]);

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
    series == null
      ? undefined
      : sections.find((section) => section.id === series.section_id);

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

  const handleSave = async () => {
    if (!series) return;
    if (!series.title.trim()) {
      setError('시리즈 제목은 필수입니다.');
      return;
    }

    if (!series.section_id) {
      setError('섹션을 선택하세요.');
      return;
    }

    if (!Number.isInteger(series.section_id) || series.section_id <= 0) {
      setError('섹션 ID는 숫자로 입력하세요.');
      return;
    }

    if (mappedEpisodeIds.length === 0) {
      setError('매핑할 에피소드 ID를 하나 이상 입력하세요.');
      return;
    }

    if (series.order != null && !Number.isFinite(series.order)) {
      setError('Order는 숫자로 입력하세요.');
      return;
    }

    const ok = await save({
      title: series.title,
      subtitle: series.subtitle || null,
      img_url: series.img_url || null,
      section_id: series.section_id,
      order: series.order,
      oem_key: series.oem_key || null,
      language: series.language,
    });

    if (!ok) return;

    setSaving(true);

    const { error: deleteMappingError } = await supabase
      .from('series_episodes')
      .delete()
      .eq('series_id', series.id);

    if (deleteMappingError) {
      setSaving(false);
      setError(`매핑 갱신에 실패했습니다: ${deleteMappingError.message}`);
      return;
    }

    const mappingRows = mappedEpisodeIds.map((episodeId, index) => ({
      series_id: series.id,
      episode_id: episodeId,
      order: index + 1,
    }));

    const { error: insertMappingError } = await supabase
      .from('series_episodes')
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

  if (!series) return null;

  return (
    <FormLayout title='시리즈 편집' id={series.id}>
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
                url={series.img_url || ''}
                title={series.title || ''}
              />
              <div className='flex flex-col gap-2 flex-1'>
                <FormField label='Title (필수)'>
                  <input
                    className='w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition'
                    name='title'
                    value={series.title || ''}
                    onChange={handleChange}
                    placeholder='title'
                  />
                </FormField>
                <FormField label='Subtitle'>
                  <input
                    className='w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition'
                    name='subtitle'
                    value={series.subtitle || ''}
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
                        value={series.section_id ?? ''}
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
                                setSeries((prev) =>
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
                value={series.img_url || ''}
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
                  value={series.order ?? ''}
                  onChange={handleChange}
                  placeholder='비워두면 NULL'
                />
              </FormField>

              <FormField label='OEM Key'>
                <input
                  className='w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition'
                  name='oem_key'
                  value={series.oem_key || ''}
                  onChange={handleChange}
                />
              </FormField>
            </div>

            <FormField label='Language'>
              <div className='flex gap-3 flex-wrap'>
                {LANG_OPTIONS.map((lang) => {
                  const selected = series.language.includes(lang.code);

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

            <FormField label='에피소드 매핑 (필수)'>
              <div className='rounded-xl border border-gray-200 overflow-hidden'>
                <div className='flex gap-2 p-2 bg-gray-50'>
                  <input
                    value={episodeIdsInput}
                    onChange={(e) => setEpisodeIdsInput(e.target.value)}
                    placeholder='에피소드 ID를 쉼표로 입력 (예: 1,2,3)'
                    className='w-full px-3 h-9 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-gray-900'
                  />
                  <button
                    type='button'
                    onClick={() => {
                      setEpisodeQuery('');
                      setIsEpisodeSearchOpen(true);
                    }}
                    className='px-3 h-9 rounded-lg border border-gray-200 text-sm whitespace-nowrap bg-white hover:bg-gray-100 shrink-0'
                  >
                    검색해서 추가
                  </button>
                </div>

                {mappedEpisodeIds.length === 0 ? (
                  <p className='px-4 py-3 text-xs text-gray-400'>선택된 에피소드가 없습니다.</p>
                ) : (
                  <div className='divide-y divide-gray-100'>
                    {mappedEpisodeIds.map((id) => {
                      const episode = episodes.find((e) => e.id === id);
                      return (
                        <div
                          key={id}
                          className='flex items-center justify-between px-4 py-2.5 bg-white hover:bg-gray-50'
                        >
                          <span className='text-sm text-gray-700'>
                            <span className='text-gray-400 mr-1'>#{id}</span>
                            {episode?.title ?? '(제목 없음)'}
                          </span>
                          <button
                            type='button'
                            onClick={() => {
                              const next = mappedEpisodeIds.filter((v) => v !== id);
                              setEpisodeIdsInput(next.join(','));
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

            {isEpisodeSearchOpen && (
              <div
                className='fixed inset-0 z-50 flex items-center justify-center bg-black/40'
                onClick={() => setIsEpisodeSearchOpen(false)}
              >
                <div
                  className='bg-white rounded-2xl shadow-xl w-full max-w-3xl mx-4 flex flex-col max-h-[80vh]'
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className='flex items-center justify-between px-5 py-4 border-b border-gray-100'>
                    <h3 className='text-sm font-semibold text-gray-900'>
                      에피소드 검색
                    </h3>
                    <button
                      type='button'
                      onClick={() => setIsEpisodeSearchOpen(false)}
                      className='text-gray-400 hover:text-gray-600 text-lg leading-none'
                    >
                      ×
                    </button>
                  </div>

                  <div className='px-5 pt-4 pb-2'>
                    <input
                      autoFocus
                      value={episodeQuery}
                      onChange={(e) => setEpisodeQuery(e.target.value)}
                      placeholder='ID 또는 제목으로 검색'
                      className='w-full px-3 h-10 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900'
                    />
                  </div>

                  <div className='flex-1 overflow-y-auto divide-y divide-gray-100 px-5 pb-2'>
                    {filteredEpisodes.length === 0 && (
                      <p className='py-4 text-sm text-gray-400 text-center'>
                        검색 결과가 없습니다.
                      </p>
                    )}
                    {filteredEpisodes.map((episode) => {
                      const isSelected = mappedEpisodeIds.includes(episode.id);
                      return (
                        <button
                          key={episode.id}
                          type='button'
                          onClick={() => {
                            const next = isSelected
                              ? mappedEpisodeIds.filter((v) => v !== episode.id)
                              : Array.from(
                                  new Set([...mappedEpisodeIds, episode.id])
                                );
                            setEpisodeIdsInput(next.join(','));
                          }}
                          className={`w-full flex items-center justify-between py-2.5 text-sm text-left transition ${
                            isSelected
                              ? 'text-gray-900 font-medium'
                              : 'text-gray-600 hover:text-gray-900'
                          }`}
                        >
                          <span>
                            <span className='text-gray-400 mr-1'>
                              #{episode.id}
                            </span>
                            {episode.title}
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
                      onClick={() => setIsEpisodeSearchOpen(false)}
                      className='w-full h-10 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-700 transition'
                    >
                      완료 ({mappedEpisodeIds.length}개 선택됨)
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </FormLayout>
  );
};

export default DemoSeriesEdit;
