import React from 'react';
import DemoTableList from '@/components/demo/DemoTableList';

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

const columns = columnDefs.map(({ key, label }) => ({ key, label }));
const gridCols = columnDefs.map(({ width }) => width).join(' ');

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
      detailPath='/demo/broadcasting/detail'
      editPath='/demo/broadcasting'
      columns={columns}
      gridCols={gridCols}
    />
  );
};

export default DemoBroadcastingList;
