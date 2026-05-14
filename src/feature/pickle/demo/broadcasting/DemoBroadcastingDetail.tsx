import DemoEntityDetail from '@/components/demo/DemoEntityDetail';
import type { RelatedListConfig } from '@/components/demo/DemoEntityDetail';

const BROADCASTING_FIELD_LABELS = {
  id: 'ID',
  title: '방송사명',
  channel: '채널명',
  frequency: '주파수',
  img_url: '썸네일',
  order: '순위',
  language: '국가',
  created_at: '생성일',
} as const;

const BROADCASTING_FIELD_ORDER = [
  'id',
  'title',
  'channel',
  'frequency',
  'img_url',
  'order',
  'language',
  'created_at',
];

const BROADCASTING_SUMMARY_FIELDS = [
  { key: 'created_at', label: '생성일' },
  { key: 'id', label: '방송사 ID' },
];

const BROADCASTING_RELATED_LIST: RelatedListConfig[] = [
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
      type: 'direct',
      filterColumn: 'broadcasting_id',
      select: '*, categories(title), broadcastings(title, channel)',
    },
  },
];

const DemoBroadcastingDetail = () => {
  return (
    <DemoEntityDetail
      parentMenu='데모 콘텐츠 관리'
      childMenu='방송사 상세'
      tableName='broadcastings'
      listPath='/demo/broadcasting'
      editPath='/demo/broadcasting'
      select='*'
      fieldLabels={BROADCASTING_FIELD_LABELS}
      fieldOrder={BROADCASTING_FIELD_ORDER}
      summaryFields={BROADCASTING_SUMMARY_FIELDS}
      relatedList={BROADCASTING_RELATED_LIST}
    />
  );
};

export default DemoBroadcastingDetail;
