import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import FormActionsButton from '@/shared/components/form/FormActionButton';
import FormField from '@/shared/components/form/FormField';
import FormLayout from '@/shared/components/form/FormLayout';
import FormTabs from '@/shared/components/form/FormTabs';
import { ThumbnailPreview } from '@/shared/components/table/ThumbnailPreview';
import useDemoEdit from '@/feature/pickle-demo/hooks/useDemoEdit';
import type { Broadcasting } from '@/shared/types/pickleDemoContents';
import { LANG_OPTIONS } from '@/constants/languages';

const DemoBroadcastingEdit = () => {
  const [searchParams] = useSearchParams();

  const initLang = searchParams.get('lang') ?? 'ko';
  const [activeTab, setActiveTab] = useState(
    initLang === 'ko' ? 'basic' : 'localize'
  );

  const {
    data: broadcasting,
    loading,
    saving,
    error,
    handleChange,
    handleLangToggle,
    save,
    navigate,
  } = useDemoEdit<Broadcasting>({
    table: 'broadcastings',
    numericFields: ['order'],
  });

  const handleSave = async () => {
    if (!broadcasting) return;
    const ok = await save({
      title: broadcasting.title,
      channel: broadcasting.channel,
      frequency: broadcasting.frequency,
      img_url: broadcasting.img_url,
      order: broadcasting.order,
      language: broadcasting.language,
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

  if (!broadcasting) return null;

  return (
    <FormLayout title='방송사 편집' id={broadcasting.id}>
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
        <div className='flex flex-col gap-6'>
          <div className='flex gap-5'>
            <ThumbnailPreview
              url={broadcasting.img_url || ''}
              title={broadcasting.title || ''}
            />
            <div className='flex flex-col gap-2'>
              <FormField label='Title'>
                <input
                  className='w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition'
                  name='title'
                  value={broadcasting.title || ''}
                  onChange={handleChange}
                  placeholder='title'
                />
              </FormField>
              <FormField label='channel'>
                <input
                  className='w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition'
                  name='channel'
                  value={broadcasting.channel || ''}
                  onChange={handleChange}
                  placeholder='channel'
                />
              </FormField>
              <FormField label='frequency'>
                <input
                  className='w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition'
                  name='frequency'
                  value={broadcasting.frequency || ''}
                  onChange={handleChange}
                  placeholder='frequency'
                />
              </FormField>
            </div>
          </div>

          <FormField label='Thumbnail URL'>
            <input
              className='w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition font-mono'
              name='img_url'
              value={broadcasting.img_url || ''}
              onChange={handleChange}
              placeholder='https://...'
            />
          </FormField>

          <div className='grid grid-cols-2 gap-6'>
            <FormField label='Language'>
              <div className='flex gap-3 flex-wrap'>
                {LANG_OPTIONS.map((lang) => {
                  const selected =
                    broadcasting.language.includes(lang.code) ?? false;

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

            <FormField label='Order'>
              <input
                className='w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition'
                name='order'
                type='number'
                value={broadcasting.order ?? ''}
                onChange={handleChange}
                placeholder='0'
              />
            </FormField>
          </div>
        </div>
      </div>
    </FormLayout>
  );
};

export default DemoBroadcastingEdit;
