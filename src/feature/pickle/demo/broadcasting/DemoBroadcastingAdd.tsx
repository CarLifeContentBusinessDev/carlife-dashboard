import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import FormActionsButton from '@/components/form/FormActionButton';
import FormField from '@/components/form/FormField';
import FormLayout from '@/components/form/FormLayout';
import FormTabs from '@/components/form/FormTabs';
import { ThumbnailPreview } from '@/components/table/ThumbnailPreview';
import { supabase } from '@/lib/supabase';
import { LANG_OPTIONS } from '@/constants/languages';

const initialState = {
  title: '',
  channel: '',
  frequency: '',
  img_url: '',
  order: '',
  language: [] as string[],
};

const DemoBroadcastingAdd = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialState);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [searchParams] = useSearchParams();
  const initLang = searchParams.get('lang') ?? 'ko';
  const [activeTab, setActiveTab] = useState(
    initLang === 'ko' ? 'basic' : 'localize'
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: name === 'order' ? Number(value) : value,
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
      setError('방송사명을 입력하세요.');
      return;
    }

    if (form.language.length === 0) {
      setError('최소 한 개 이상의 국가를 선택하세요.');
      return;
    }

    setSaving(true);
    setError('');

    const { error } = await supabase.from('broadcastings').insert([
      {
        title: form.title,
        channel: form.channel || null,
        frequency: form.frequency || null,
        img_url: form.img_url || null,
        order: form.order || 0,
        language: form.language,
      },
    ]);

    setSaving(false);

    if (error) setError(error.message);
    else navigate(-1);
  };

  return (
    <FormLayout title='방송사 추가'>
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

          <div className='flex flex-col gap-2'>
            <FormField label='Title *'>
              <input
                name='title'
                value={form.title}
                onChange={handleChange}
                className='w-full px-4 h-10 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900'
              />
            </FormField>
            <FormField label='Channel'>
              <input
                name='channel'
                value={form.channel}
                onChange={handleChange}
                className='w-full px-4 h-10 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900'
              />
            </FormField>

            <FormField label='Frequency'>
              <input
                name='frequency'
                value={form.frequency}
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
      </div>
    </FormLayout>
  );
};

export default DemoBroadcastingAdd;
