import DemoEntityDetail from '@/components/demo/DemoEntityDetail';

const SERIES_FIELD_LABELS = {
  id: 'ID',
  title: '제목',
  subtitle: '부제',
  img_url: '썸네일',
  sections: '섹션',
  section_id: '섹션 ID',
  oem_key: 'OEM 키',
  language: '국가',
  order: '순위',
  created_at: '생성일',
} as const;

const SERIES_FIELD_ORDER = [
  'id',
  'title',
  'subtitle',
  'img_url',
  'sections',
  'section_id',
  'oem_key',
  'language',
  'order',
  'created_at',
];

const SERIES_SUMMARY_FIELDS = [
  { key: 'created_at', label: '생성일' },
  { key: 'id', label: '시리즈 ID' },
];

const DemoSeriesDetail = () => {
  return (
    <DemoEntityDetail
      parentMenu='데모 콘텐츠 관리'
      childMenu='시리즈 상세'
      tableName='series'
      listPath='/demo/series'
      editPath='/demo/series'
      select='*, sections(title)'
      fieldLabels={SERIES_FIELD_LABELS}
      fieldOrder={SERIES_FIELD_ORDER}
      summaryFields={SERIES_SUMMARY_FIELDS}
    />
  );
};

export default DemoSeriesDetail;
