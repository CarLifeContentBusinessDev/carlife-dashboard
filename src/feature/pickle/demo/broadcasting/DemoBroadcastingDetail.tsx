import DemoEntityDetail from '@/components/demo/DemoEntityDetail';

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
    />
  );
};

export default DemoBroadcastingDetail;
