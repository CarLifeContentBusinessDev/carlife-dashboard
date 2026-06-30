import DemoEntityDetail from '@/feature/pickle-demo/components/DemoEntityDetail';
import type { RelatedListConfig } from '@/feature/pickle-demo/components/DemoEntityDetail';

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

const SERIES_RELATED_LIST: RelatedListConfig[] = [
  {
    title: '에피소드 목록',
    tableName: 'episodes',
    detailPath: '/pickle/demo/episodes/detail',
    editPath: '/pickle/demo/episodes/edit',
    columnDefs: [
      { key: 'id', label: 'ID', width: 'minmax(40px,0.5fr)' },
      { key: 'title', label: 'title', width: 'minmax(80px,2fr)' },
      { key: 'programs.title', label: '프로그램', width: 'minmax(80px,1.5fr)' },
      { key: 'date', label: '날짜', width: 'minmax(80px,1fr)' },
      { key: 'duration', label: '길이', width: 'minmax(80px,1fr)' },
      { key: 'is_active', label: '상태', width: 'minmax(80px,1fr)' },
      { key: 'language', label: '국가', width: 'minmax(80px,0.5fr)' },
    ],
    query: {
      type: 'junction',
      junctionTable: 'series_episodes',
      junctionKey: 'series_id',
      junctionForeignKey: 'episode_id',
      select: '*, programs(title)',
    },
  },
];

const DemoSeriesDetail = () => {
  return (
    <DemoEntityDetail
      parentMenu='데모 콘텐츠 관리'
      childMenu='시리즈 상세'
      tableName='series'
      listPath='/pickle/demo/series'
      editPath='/pickle/demo/series/edit'
      select='*, sections(title)'
      fieldLabels={SERIES_FIELD_LABELS}
      fieldOrder={SERIES_FIELD_ORDER}
      summaryFields={SERIES_SUMMARY_FIELDS}
      relatedList={SERIES_RELATED_LIST}
    />
  );
};

export default DemoSeriesDetail;
