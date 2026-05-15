// 언어 코드, 라벨, 컬럼명 등 국가/언어 관련 공통 상수
export const LANGUAGES = [
  { value: 'all', label: '전체' },
  { value: 'ko', label: '한국 (ko)' },
  { value: 'en', label: '북미 (en)' },
  { value: 'de', label: '독일 (de)' },
  { value: 'jp', label: '일본 (jp)' },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]['value'];

export const LANG_COLUMN_MAP = {
  all: { title: 'title', img_url: 'img_url' },
  ko: { title: 'title', img_url: 'img_url' },
  en: { title: 'en_title', img_url: 'en_img_url' },
  de: { title: 'de_title', img_url: 'de_img_url' },
  jp: { title: 'jp_title', img_url: 'jp_img_url' },
} as const;

export const LANG_OPTIONS = [
  { code: 'ko', label: '한국' },
  { code: 'en', label: '북미' },
  { code: 'de', label: '독일' },
  { code: 'jp', label: '일본' },
] as const;

export const LANGUAGE_TO_COUNTRY: Record<string, string> = {
  ko: 'KR',
  en: 'US',
  de: 'DE',
  jp: 'JP',
};

export const LANG_SECTIONS = [
  { lang: 'en', label: '북미', titleKey: 'en_title', imgKey: 'en_img_url' },
  { lang: 'de', label: '독일', titleKey: 'de_title', imgKey: 'de_img_url' },
  { lang: 'jp', label: '일본', titleKey: 'jp_title', imgKey: 'jp_img_url' },
] as const;
