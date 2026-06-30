import React from 'react';
import DemoTableList from '@/feature/pickle-demo/components/DemoTableList';

interface DemoBroadcastingListProps {
  broadcasting: any[];
  selectedLang: string;
  onDeleted?: () => void;
}

const columnDefs = [
  { key: 'id', label: 'ID', width: 'minmax(40px,0.5fr)' },
  { key: 'title', label: 'title', width: 'minmax(80px,1fr)' },
  { key: 'channel', label: 'channel', width: 'minmax(80px,1fr)' },
  { key: 'frequency', label: 'frequency', width: 'minmax(80px,1fr)' },
  { key: 'img_url', label: '썸네일', width: 'minmax(120px,1fr)' },
  { key: 'order', label: '순위', width: 'minmax(60px,0.5fr)' },
  { key: 'language', label: '국가', width: 'minmax(80px,0.8fr)' },
  { key: 'programsCount', label: '프로그램 수', width: 'minmax(100px,0.8fr)' },
  { key: 'is_active', label: '상태', width: 'minmax(40px,0.8fr)' },
  { key: 'is_searchable', label: '검색', width: 'minmax(40px,0.8fr)' },
  { key: 'actions', label: '', width: 'minmax(140px,1fr)' },
];

const DemoBroadcastingList: React.FC<DemoBroadcastingListProps> = ({
  broadcasting,
  selectedLang,
  onDeleted,
}) => {
  return (
    <DemoTableList
      data={broadcasting}
      selectedLang={selectedLang}
      onDeleted={onDeleted}
      tableName='broadcastings'
      detailPath='/pickle/demo/broadcastings/detail'
      editPath='/pickle/demo/broadcastings/edit'
      columnDefs={columnDefs}
    />
  );
};

export default DemoBroadcastingList;
