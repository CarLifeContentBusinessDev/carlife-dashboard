import DemoEntityDetail from '@/feature/pickle-demo/components/DemoEntityDetail';
import type { RelatedListConfig } from '@/feature/pickle-demo/components/DemoEntityDetail';

const PROGRAM_FIELD_LABELS = {
  id: 'ID',
  title: '제목',
  subtitle: '부제',
  type: '유형',
  img_url: '썸네일',
  category_id: '카테고리 ID',
  categories: '카테고리',
  broadcasting_id: '방송사 ID',
  broadcastings: '방송사',
  language: '국가',
  is_sequential: '역순 여부',
  order: '순위',
  created_at: '생성일',
  is_active: 'status',
  is_searchable: 'searchable',
} as const;

const PROGRAM_FIELD_ORDER = [
  'id',
  'title',
  'subtitle',
  'type',
  'img_url',
  'categories',
  'category_id',
  'broadcastings',
  'broadcasting_id',
  'language',
  'is_sequential',
  'order',
  'created_at',
  'is_active',
  'is_searchable',
];

const PROGRAM_SUMMARY_FIELDS = [
  { key: 'created_at', label: '생성일' },
  { key: 'id', label: '프로그램 ID' },
  { key: 'type', label: '유형' },
];

const PROGRAM_HIDDEN_FIELDS = [
  'is_live',
  'is_liked',
  'order_broadcasting',
  'order_category',
  'order_live',
  'order_popular',
];

const PROGRAM_RELATED_LIST: RelatedListConfig[] = [
  {
    title: '에피소드 목록',
    tableName: 'episodes',
    detailPath: '/demo/episodes/detail',
    editPath: '/demo/episodes/edit',
    columnDefs: [
      { key: 'id', label: 'ID', width: 'minmax(40px,0.5fr)' },
      { key: 'title', label: 'title', width: 'minmax(80px,3fr)' },
      { key: 'date', label: '날짜', width: 'minmax(80px,1fr)' },
      { key: 'duration', label: '길이', width: 'minmax(80px,1fr)' },
      { key: 'is_active', label: '상태', width: 'minmax(80px,1fr)' },
      { key: 'language', label: '국가', width: 'minmax(80px,0.5fr)' },
    ],
    query: {
      type: 'direct',
      filterColumn: 'program_id',
      select: '*, programs(title)',
    },
  },
];

const DemoProgramDetail = () => {
  return (
    <DemoEntityDetail
      parentMenu='데모 콘텐츠 관리'
      childMenu='프로그램 상세'
      tableName='programs'
      listPath='/demo/programs'
      editPath='/demo/programs/edit'
      select='*, categories(title), broadcastings(title, channel)'
      fieldLabels={PROGRAM_FIELD_LABELS}
      fieldOrder={PROGRAM_FIELD_ORDER}
      summaryFields={PROGRAM_SUMMARY_FIELDS}
      hiddenFields={PROGRAM_HIDDEN_FIELDS}
      relatedList={PROGRAM_RELATED_LIST}
    />
  );
};

export default DemoProgramDetail;
