import DemoEntityDetail from '@/components/demo/DemoEntityDetail';
import type { RelatedListConfig } from '@/components/demo/DemoEntityDetail';

const CATEGORY_FIELD_LABELS = {
  id: 'ID',
  title: '제목',
  img_url: '썸네일',
  order: '순위',
  language: '국가',
  created_at: '생성일',
  en_title: '영문 제목',
  en_img_url: '영문 썸네일',
  de_title: '독일어 제목',
  de_img_url: '독일어 썸네일',
  jp_title: '일본어 제목',
  jp_img_url: '일본어 썸네일',
} as const;

const CATEGORY_FIELD_ORDER = [
  'id',
  'title',
  'img_url',
  'order',
  'language',
  'created_at',
  'en_title',
  'en_img_url',
  'de_title',
  'de_img_url',
  'jp_title',
  'jp_img_url',
];

const CATEGORY_SUMMARY_FIELDS = [
  { key: 'created_at', label: '생성일' },
  { key: 'id', label: '카테고리 ID' },
];

const CATEGORY_RELATED_LIST: RelatedListConfig[] = [
  {
    title: '프로그램 목록',
    tableName: 'programs',
    detailPath: '/demo/program/detail',
    editPath: '/demo/program',
    columnDefs: [
      { key: 'id', label: 'ID', width: 'minmax(40px,0.5fr)' },
      { key: 'img_url', label: '썸네일', width: 'minmax(80px,1fr)' },
      { key: 'title', label: 'title', width: 'minmax(80px,2fr)' },
      { key: 'type', label: 'type', width: 'minmax(40px,1fr)' },
      { key: 'broadcastings.title', label: '방송사', width: 'minmax(40px,1.5fr)' },
      { key: 'language', label: '국가', width: 'minmax(80px,1fr)' },
      { key: 'is_active', label: '상태', width: 'minmax(40px,1fr)' },
    ],
    query: {
      type: 'direct',
      filterColumn: 'category_id',
      select: '*, categories(title), broadcastings(title, channel)',
    },
    enableLangFilter: true,
  },
];

const DemoCategoryDetail = () => {
  return (
    <DemoEntityDetail
      parentMenu='데모 콘텐츠 관리'
      childMenu='카테고리 상세'
      tableName='categories'
      listPath='/demo/category'
      editPath='/demo/category'
      select='*'
      fieldLabels={CATEGORY_FIELD_LABELS}
      fieldOrder={CATEGORY_FIELD_ORDER}
      summaryFields={CATEGORY_SUMMARY_FIELDS}
      relatedList={CATEGORY_RELATED_LIST}
    />
  );
};

export default DemoCategoryDetail;
