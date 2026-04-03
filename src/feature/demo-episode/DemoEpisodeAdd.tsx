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

interface ProgramOption {
  id: number;
  title: string;
  img_url: string | null;
}

const initialState = {
  title: '',
  type: '',
  img_url: '',
  program_id: '',
  date: '',
  duration: '',
  audio_file: '',
  audioFile_dubbing: '',
  language: [] as string[],
  is_active: true,
  is_searchable: true,
  theme_color: '',
  sub_title: '',
};

const DemoEpisodeAdd = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialState);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [programs, setPrograms] = useState<ProgramOption[]>([]);
  const [programQuery, setProgramQuery] = useState('');
  const [isProgramSearchOpen, setIsProgramSearchOpen] = useState(false);
  const [isDubbingEpisode, setIsDubbingEpisode] = useState(false);
  const [searchParams] = useSearchParams();
  const initLang = searchParams.get('lang') ?? 'ko';
  const [activeTab, setActiveTab] = useState(
    initLang === 'ko' ? 'basic' : 'localize'
  );

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

  const selectedProgram = programs.find(
    (program) => String(program.id) === form.program_id
  );
  const thumbnailPreviewUrl =
    form.img_url.trim() || selectedProgram?.img_url?.trim() || '';

  useEffect(() => {
    const fetchPrograms = async () => {
      const { data } = await supabase
        .from('programs')
        .select('id, title, img_url')
        .order('id');
      setPrograms((data ?? []) as ProgramOption[]);
    };

    fetchPrograms();
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
      setError('에피소드 제목은 필수입니다.');
      return;
    }

    if (!form.program_id) {
      setError('프로그램을 선택하세요.');
      return;
    }

    if (form.language.length === 0) {
      setError('최소 한 개 이상의 언어를 선택하세요.');
      return;
    }

    const programId = Number(form.program_id);
    if (!Number.isInteger(programId) || programId <= 0) {
      setError('프로그램 ID는 숫자로 입력하세요.');
      return;
    }

    setSaving(true);
    setError('');

    const { error } = await supabase.from('episodes').insert([
      {
        title: form.title,
        type: form.type || null,
        img_url: form.img_url.trim() || null,
        program_id: programId,
        date: form.date || null,
        duration: form.duration || null,
        audio_file: form.audio_file || null,
        audioFile_dubbing: isDubbingEpisode
          ? form.audioFile_dubbing || null
          : null,
        language: form.language,
        is_active: form.is_active,
        is_searchable: form.is_searchable,
        theme_color:
          form.type === 'ai-music' ? form.theme_color.trim() || null : null,
        sub_title:
          form.type === 'ai-music' ? form.sub_title.trim() || null : null,
      },
    ]);

    setSaving(false);

    if (error) setError(error.message);
    else navigate(-1);
  };

  return (
    <FormLayout title='에피소드 추가'>
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
            <ThumbnailPreview url={thumbnailPreviewUrl} title={form.title} />
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
            <FormField label='Type'>
              <input
                name='type'
                value={form.type}
                onChange={handleChange}
                className='w-full px-4 h-10 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900'
              />
            </FormField>
            <FormField label='프로그램 (필수)'>
              <div className='flex flex-col gap-2'>
                <div className='flex gap-2'>
                  <input
                    name='program_id'
                    value={form.program_id}
                    onChange={handleChange}
                    inputMode='numeric'
                    placeholder='프로그램 ID 직접 입력'
                    className='w-full px-4 h-10 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900'
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
                            setForm((prev) => ({
                              ...prev,
                              program_id: String(program.id),
                            }));
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

        <div className='grid grid-cols-1 gap-8'>
          <FormField label='날짜'>
            <input
              name='date'
              value={form.date}
              onChange={handleChange}
              placeholder='YY.MM.DD'
              className='w-full px-4 h-10 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900'
            />
          </FormField>

          <FormField label='오디오 파일 URL'>
            <div className='flex gap-2'>
              <input
                name='audio_file'
                value={form.audio_file}
                onChange={handleChange}
                className='w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-gray-900'
              />
              <button
                type='button'
                onClick={() => {
                  if (!form.audio_file.trim()) return;
                  window.open(
                    form.audio_file.trim(),
                    '_blank',
                    'noopener,noreferrer'
                  );
                }}
                disabled={!form.audio_file.trim()}
                className='px-4 py-2.5 rounded-xl border border-gray-200 text-sm whitespace-nowrap bg-white hover:bg-gray-50 disabled:opacity-50'
              >
                바로가기
              </button>
            </div>
          </FormField>
          <FormField label='재생 시간'>
            <input
              name='duration'
              value={form.duration}
              onChange={handleChange}
              placeholder='H:MM:SS'
              className='w-full px-4 h-10 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900'
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
                      setForm((prev) => ({
                        ...prev,
                        audioFile_dubbing: '',
                      }));
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
                name='audioFile_dubbing'
                value={form.audioFile_dubbing}
                onChange={handleChange}
                className='w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-gray-900'
              />
            </FormField>
          )}
        </div>

        <div className='grid grid-cols-2 gap-8'>
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

        {form.type === 'ai-music' && (
          <div className='grid grid-cols-1 gap-8'>
            <FormField label='테마 색상 (ai-music)'>
              <div className='flex gap-2'>
                <input
                  type='color'
                  name='theme_color'
                  value={form.theme_color || '#6EFFCF'}
                  onChange={handleChange}
                  className='w-12 h-10 rounded-xl border border-gray-200 cursor-pointer'
                />
                <input
                  type='text'
                  name='theme_color'
                  value={form.theme_color}
                  onChange={handleChange}
                  placeholder='#6EFFCF'
                  className='flex-1 px-4 h-10 rounded-xl border border-gray-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-gray-900'
                />
              </div>
            </FormField>

            <FormField label='부제목 (ai-music)'>
              <input
                name='sub_title'
                value={form.sub_title}
                onChange={handleChange}
                placeholder='부제목 입력'
                className='w-full px-4 h-10 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900'
              />
            </FormField>
          </div>
        )}
      </div>

      {error && <div className='text-red-500 text-sm mt-4'>{error}</div>}
    </FormLayout>
  );
};

export default DemoEpisodeAdd;
