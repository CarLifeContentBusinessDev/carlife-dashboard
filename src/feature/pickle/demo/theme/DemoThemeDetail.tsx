import DemoEntityDetail from '@/components/demo/DemoEntityDetail';
import type { RelatedListConfig } from '@/components/demo/DemoEntityDetail';

const THEME_FIELD_LABELS = {
  id: 'ID',
  title: '제목',
  subtitle: '부제',
  img_url: '썸네일',
  sections: '섹션',
  section_id: '섹션 ID',
  language: '국가',
  order: '순위',
  created_at: '생성일',
} as const;

const THEME_FIELD_ORDER = [
  'id',
  'title',
  'subtitle',
  'img_url',
  'sections',
  'section_id',
  'language',
  'order',
  'created_at',
];

const THEME_SUMMARY_FIELDS = [
  { key: 'created_at', label: '생성일' },
  { key: 'id', label: '테마 ID' },
];

const THEME_RELATED_LIST: RelatedListConfig[] = [
  {
    title: '프로그램 목록',
    tableName: 'programs',
    detailPath: '/demo/program/detail',
    editPath: '/demo/program',
    columns: [
      { key: 'id', label: 'ID' },
      { key: 'img_url', label: '썸네일' },
      { key: 'title', label: 'title' },
      { key: 'type', label: 'type' },
      { key: 'categories.title', label: '카테고리' },
      { key: 'language', label: '국가' },
      { key: 'is_active', label: '상태' },
    ],
    gridCols:
      'minmax(40px,0.5fr) minmax(80px,1fr) minmax(80px,2fr) minmax(40px,1fr) minmax(40px,1.5fr) minmax(80px,1fr) minmax(40px,1fr)',
    query: {
      type: 'junction',
      junctionTable: 'themes_programs',
      junctionKey: 'theme_id',
      junctionForeignKey: 'program_id',
      select: '*, categories(title), broadcastings(title, channel)',
    },
  },
];

const DemoThemeDetail = () => {
  return (
    <DemoEntityDetail
      parentMenu='데모 콘텐츠 관리'
      childMenu='테마 상세'
      tableName='themes'
      listPath='/demo/theme'
      editPath='/demo/theme'
      select='*, sections(title)'
      fieldLabels={THEME_FIELD_LABELS}
      fieldOrder={THEME_FIELD_ORDER}
      summaryFields={THEME_SUMMARY_FIELDS}
      relatedList={THEME_RELATED_LIST}
    />
  );
};

export default DemoThemeDetail;
