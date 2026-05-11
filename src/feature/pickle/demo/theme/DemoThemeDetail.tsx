import DemoEntityDetail from '../../../../components/demo/DemoEntityDetail';

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
    />
  );
};

export default DemoThemeDetail;
