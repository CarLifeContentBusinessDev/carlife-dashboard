import FormActionsButton from '@/components/form/FormActionButton';
import FormField from '@/components/form/FormField';
import FormLayout from '@/components/form/FormLayout';
import FormTabs from '@/components/form/FormTabs';
import { ThumbnailPreview } from '@/components/table/ThumbnailPreview';
import { LANG_OPTIONS, LANG_SECTIONS } from '@/constants/languages';
import useDemoEdit from '@/hook/useDemoEdit';
import type { Category } from '@/types/pickleDemoContents';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

const DemoCategoryEdit = () => {
  const [searchParams] = useSearchParams();

  const initLang = searchParams.get('lang') ?? 'ko';
  const [activeTab, setActiveTab] = useState(
    initLang === 'ko' || initLang === 'all' ? 'basic' : 'localize'
  );

  const langRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const {
    data: category,
    loading,
    saving,
    error,
    handleChange,
    handleLangToggle,
    save,
    navigate,
  } = useDemoEdit<Category>({
    table: 'categories',
    numericFields: ['order'],
  });

  const visibleLangSections = LANG_SECTIONS.filter((section) =>
    category?.language?.includes(section.lang)
  );

  useEffect(() => {
    if (!category || activeTab !== 'localize') return;
    const targetLang = visibleLangSections.some(
      (section) => section.lang === initLang
    )
      ? initLang
      : visibleLangSections[0]?.lang;
    if (!targetLang) return;

    const el = langRefs.current[targetLang];
    if (el) {
      setTimeout(
        () => el.scrollIntoView({ behavior: 'smooth', block: 'start' }),
        100
      );
    }
  }, [category, activeTab, initLang, visibleLangSections]);

  const handleSave = async () => {
    if (!category) return;
    const ok = await save({
      title: category.title,
      img_url: category.img_url,
      order: category.order,
      en_title: category.en_title,
      en_img_url: category.en_img_url,
      de_title: category.de_title,
      de_img_url: category.de_img_url,
      jp_title: category.jp_title,
      jp_img_url: category.jp_img_url,
      language: category.language,
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

  if (!category) return null;

  return (
    <FormLayout title='카테고리 편집' id={category.id}>
      {/* 탭 + 버튼 행 */}
      <div className='flex justify-between items-center flex-shrink-0 mb-6'>
        <FormTabs
          tabs={[
            { key: 'basic', label: '기본 정보 (한국)' },
            { key: 'localize', label: '해외 설정' },
          ]}
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
            <ThumbnailPreview
              url={category.img_url || ''}
              title={category.title || ''}
            />

            <div className='grid grid-cols-2 gap-6'>
              <FormField label='Title (한국어)'>
                <input
                  className='w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition'
                  name='title'
                  value={category.title || ''}
                  onChange={handleChange}
                  placeholder='카테고리 제목'
                />
              </FormField>
              <FormField label='Order'>
                <input
                  className='w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition'
                  name='order'
                  type='number'
                  value={category.order ?? ''}
                  onChange={handleChange}
                  placeholder='0'
                />
              </FormField>
            </div>

            <FormField label='Thumbnail URL'>
              <input
                className='w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition font-mono'
                name='img_url'
                value={category.img_url || ''}
                onChange={handleChange}
                placeholder='https://...'
              />
            </FormField>

            <FormField label='Language'>
              <div className='flex gap-3 flex-wrap'>
                {LANG_OPTIONS.map((lang) => {
                  const selected = category.language.includes(lang.code);

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

            {/* <FormField
              label='Language'
              hint='지원할 언어를 쉼표로 구분하여 입력하세요. 예: ko, en, de, jp'
            >
              <input
                className='w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition'
                name='language'
                value={
                  Array.isArray(category.language)
                    ? category.language.join(', ')
                    : ''
                }
                onChange={handleLangChange}
                placeholder='ko, en, de, jp'
              />
              {Array.isArray(category.language) &&
                category.language.length > 0 && (
                  <div className='flex gap-1.5 mt-1 flex-wrap'>
                    {category.language.map((lang) => (
                      <span
                        key={lang}
                        className='px-2.5 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs font-medium'
                      >
                        {lang}
                      </span>
                    ))}
                  </div>
                )}
            </FormField> */}
          </div>
        )}

        {activeTab === 'localize' && (
          <div className='flex flex-col divide-y divide-gray-100'>
            {visibleLangSections.length === 0 ? (
              <div className='py-10 text-center text-sm text-gray-500'>
                선택된 해외 언어가 없습니다.
              </div>
            ) : (
              visibleLangSections.map((section) => {
                const isActive = section.lang === initLang;
                return (
                  <div
                    key={section.lang}
                    ref={(el) => {
                      langRefs.current[section.lang] = el;
                    }}
                    className={`py-6 rounded-xl transition-colors duration-500 px-4 ${
                      isActive ? 'bg-blue-50 ring-1 ring-blue-100' : ''
                    }`}
                  >
                    <div className='flex items-center gap-2 mb-4'>
                      <span className='font-semibold text-gray-700 text-sm'>
                        {section.label}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-mono ${
                          isActive
                            ? 'bg-blue-100 text-blue-600'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {section.lang}
                      </span>
                      {isActive && (
                        <span className='text-xs text-blue-500 font-medium'>
                          현재 편집 중
                        </span>
                      )}
                    </div>

                    <div className='flex gap-6 items-start'>
                      <ThumbnailPreview
                        url={(category[section.imgKey] as string) || ''}
                        title={(category[section.titleKey] as string) || ''}
                      />
                      <div className='flex flex-col gap-4 flex-1'>
                        <FormField label='Title'>
                          <input
                            className='w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition'
                            name={section.titleKey}
                            value={(category[section.titleKey] as string) || ''}
                            onChange={handleChange}
                            placeholder={`${section.label} 제목`}
                          />
                        </FormField>
                        <FormField label='Thumbnail URL'>
                          <input
                            className='w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition font-mono'
                            name={section.imgKey}
                            value={(category[section.imgKey] as string) || ''}
                            onChange={handleChange}
                            placeholder='https://...'
                          />
                        </FormField>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </FormLayout>
  );
};

export default DemoCategoryEdit;
