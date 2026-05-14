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

interface EpisodeForm {
  id: number;
  title: string;
  type: string;
  img_url: string;
  program_id: number | null;
  date: string;
  created_at: string;
  duration: string;
  audio_file: string;
  audioFile_dubbing: string;
  language: string[];
  is_active: boolean;
  is_searchable: boolean;
  theme_color?: string;
  sub_title?: string;
}

interface ProgramOption {
  id: number;
  title: string;
  img_url: string | null;
}

const DemoEpisodeEdit = () => {
  const [activeTab, setActiveTab] = useState('basic');
  const [programs, setPrograms] = useState<ProgramOption[]>([]);
  const [programQuery, setProgramQuery] = useState('');
  const [isProgramSearchOpen, setIsProgramSearchOpen] = useState(false);
  const [isDubbingEpisode, setIsDubbingEpisode] = useState(false);

  const {
    data: episode,
    setData: setEpisode,
    loading,
    saving,
    error,
    setError,
    handleChange,
    handleLangToggle,
    save,
    navigate,
  } = useDemoEdit<EpisodeForm>({
    table: 'episodes',
    numericFields: ['program_id'],
  });

  useEffect(() => {
    supabase
      .from('programs')
      .select('id, title, img_url')
      .order('id')
      .then(({ data }) => setPrograms((data ?? []) as ProgramOption[]));
  }, []);

  useEffect(() => {
    if (episode) setIsDubbingEpisode(Boolean(episode.audioFile_dubbing));
  }, [episode]);

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

  const selectedProgram =
    episode == null
      ? undefined
      : programs.find((program) => program.id === episode.program_id);
  const thumbnailPreviewUrl =
    (episode?.img_url ?? '').trim() || selectedProgram?.img_url?.trim() || '';

  const handleToggleActive = () => {
    setEpisode((prev) =>
      prev ? { ...prev, is_active: !prev.is_active } : prev
    );
  };

  const handleToggleSearchable = () => {
    setEpisode((prev) =>
      prev ? { ...prev, is_searchable: !prev.is_searchable } : prev
    );
  };

  const handleSave = async () => {
    if (!episode) return;
    if (!episode.title.trim()) {
      setError('에피소드 제목은 필수입니다.');
      return;
    }

    if (!episode.program_id) {
      setError('프로그램을 선택하세요.');
      return;
    }

    if (!Number.isInteger(episode.program_id) || episode.program_id <= 0) {
      setError('프로그램 ID는 숫자로 입력하세요.');
      return;
    }

    const ok = await save({
      title: episode.title,
      type: episode.type || null,
      img_url: episode.img_url.trim() || null,
      program_id: episode.program_id,
      date: episode.date || null,
      duration: episode.duration || null,
      audio_file: episode.audio_file || null,
      audioFile_dubbing: isDubbingEpisode
        ? episode.audioFile_dubbing || null
        : null,
      language: episode.language,
      is_active: episode.is_active,
      is_searchable: episode.is_searchable,
      theme_color:
        episode.type === 'ai-music'
          ? episode.theme_color?.trim() || null
          : null,
      sub_title:
        episode.type === 'ai-music' ? episode.sub_title?.trim() || null : null,
    });
    if (ok) navigate(-1);
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

  if (!episode) return null;

  return (
    <FormLayout title='에피소드 편집' id={episode.id}>
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
                url={thumbnailPreviewUrl}
                title={episode.title || ''}
              />
              <div className='flex flex-col gap-2 flex-1'>
                <FormField label='Title (필수)'>
                  <input
                    className='w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition'
                    name='title'
                    value={episode.title || ''}
                    onChange={handleChange}
                    placeholder='title'
                  />
                </FormField>
                <FormField label='Type'>
                  <input
                    className='w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition'
                    name='type'
                    value={episode.type || ''}
                    onChange={handleChange}
                    placeholder='type'
                  />
                </FormField>
                <FormField label='프로그램 (필수)'>
                  <div className='flex flex-col gap-2'>
                    <div className='flex gap-2'>
                      <input
                        className='w-full px-4 h-10 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900'
                        name='program_id'
                        value={episode.program_id ?? ''}
                        onChange={handleChange}
                        inputMode='numeric'
                        placeholder='프로그램 ID 직접 입력'
                      />
                      <button
                        type='button'
                        onClick={() => setIsProgramSearchOpen((prev) => !prev)}
                        className='px-4 h-10 rounded-xl border border-gray-200 text-sm whitespace-nowrap bg-white hover:bg-gray-50'
                      >
                        {isProgramSearchOpen ? '검색 닫기' : '검색해서 선택'}
                      </button>
                    </div>

                    {selectedProgram && (
                      <p className='text-xs text-gray-500'>
                        선택된 프로그램: #{selectedProgram.id}{' '}
                        {selectedProgram.title}
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
                                setEpisode((prev) =>
                                  prev
                                    ? {
                                        ...prev,
                                        program_id: program.id,
                                      }
                                    : prev
                                );
                                setProgramQuery(program.title);
                                setIsProgramSearchOpen(false);
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
            </div>

            <div className='grid grid-cols-2 gap-6'>
              <FormField label='Thumbnail URL'>
                <input
                  className='w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition font-mono'
                  name='img_url'
                  value={episode.img_url || ''}
                  onChange={handleChange}
                  placeholder='https://...'
                />
              </FormField>

              <FormField label='생성일시 (자동)'>
                <input
                  className='w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition'
                  value={episode.created_at || '-'}
                  disabled
                />
              </FormField>
            </div>

            <FormField label='Language'>
              <div className='flex gap-3 flex-wrap'>
                {LANG_OPTIONS.map((lang) => {
                  const selected = episode.language.includes(lang.code);

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

            <FormField label='날짜'>
              <input
                className='w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition'
                name='date'
                value={episode.date || ''}
                onChange={handleChange}
                placeholder='예: 2026-03-18'
              />
            </FormField>

            <FormField label='오디오 파일 URL'>
              <div className='flex gap-2'>
                <input
                  className='w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition font-mono'
                  name='audio_file'
                  value={episode.audio_file || ''}
                  onChange={handleChange}
                  placeholder='https://...'
                />
                <button
                  type='button'
                  onClick={() => {
                    if (!episode.audio_file.trim()) return;
                    window.open(
                      episode.audio_file.trim(),
                      '_blank',
                      'noopener,noreferrer'
                    );
                  }}
                  disabled={!episode.audio_file.trim()}
                  className='px-4 py-2.5 rounded-xl border border-gray-200 text-sm whitespace-nowrap bg-white hover:bg-gray-50 disabled:opacity-50'
                >
                  바로가기
                </button>
              </div>
            </FormField>

            <FormField label='재생 시간'>
              <input
                className='w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition'
                name='duration'
                value={episode.duration ?? ''}
                onChange={handleChange}
                placeholder='예: 45분 7초'
              />
            </FormField>

            <FormField
              label={
                <span className='inline-flex items-center gap-2'>
                  더빙
                  <input
                    type='checkbox'
                    checked={isDubbingEpisode}
                    aria-label='더빙 여부'
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setIsDubbingEpisode(checked);

                      if (!checked) {
                        setEpisode((prev) =>
                          prev ? { ...prev, audioFile_dubbing: '' } : prev
                        );
                      }
                    }}
                    className='h-4 w-4 rounded border-gray-300 accent-gray-900'
                  />
                </span>
              }
            />

            {isDubbingEpisode && (
              <FormField label='더빙 오디오 파일 URL'>
                <input
                  className='w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition font-mono'
                  name='audioFile_dubbing'
                  value={episode.audioFile_dubbing || ''}
                  onChange={handleChange}
                  placeholder='https://...'
                />
              </FormField>
            )}

            <div className='grid grid-cols-2 gap-8'>
              <FormField label='공개 여부'>
                <button
                  type='button'
                  onClick={handleToggleActive}
                  className={`w-fit px-4 h-10 rounded-full text-sm font-medium transition border ${
                    episode.is_active
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-gray-500'
                  }`}
                >
                  {episode.is_active ? '공개' : '비공개'}
                </button>
              </FormField>

              <FormField label='검색 가능'>
                <button
                  type='button'
                  onClick={handleToggleSearchable}
                  className={`w-fit px-4 h-10 rounded-full text-sm font-medium transition border ${
                    episode.is_searchable
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-gray-500'
                  }`}
                >
                  {episode.is_searchable ? '가능' : '불가능'}
                </button>
              </FormField>
            </div>

            {episode.type === 'ai-music' && (
              <div className='grid grid-cols-2 gap-8'>
                <FormField label='테마 색상 (ai-music)'>
                  <div className='flex gap-2'>
                    <input
                      type='color'
                      name='theme_color'
                      value={
                        episode.theme_color ? episode.theme_color : '#FFFFFF'
                      }
                      onChange={handleChange}
                      className='w-12 h-10 rounded-xl cursor-pointer'
                    />
                    <input
                      type='text'
                      name='theme_color'
                      value={episode.theme_color || ''}
                      onChange={handleChange}
                      placeholder='#FFFFFF'
                      className='flex-1 px-4 h-10 rounded-xl border border-gray-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-gray-900'
                    />
                  </div>
                </FormField>

                <FormField label='부제목 (ai-music)'>
                  <input
                    name='sub_title'
                    value={episode.sub_title || ''}
                    onChange={handleChange}
                    placeholder='부제목 입력'
                    className='w-full px-4 h-10 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900'
                  />
                </FormField>
              </div>
            )}
          </div>
        )}
      </div>
    </FormLayout>
  );
};

export default DemoEpisodeEdit;
