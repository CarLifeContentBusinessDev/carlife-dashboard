import React from 'react';
import DemoTableList from '@/components/demo/DemoTableList';

interface DemoProgramListProps {
  programs: any[];
  selectedLang: string;
  onDeleted?: () => void;
}

const columnDefs = [
  { key: 'id', label: 'ID', width: 'minmax(40px,0.5fr)' },
  { key: 'img_url', label: '썸네일', width: 'minmax(80px,1fr)' },
  { key: 'title', label: 'title', width: 'minmax(80px,2fr)' },
  { key: 'type', label: 'type', width: 'minmax(40px,1fr)' },
  { key: 'categories.title', label: '카테고리', width: 'minmax(40px,1.5fr)' },
  { key: 'broadcastingLabel', label: '방송사', width: 'minmax(40px,1.5fr)' },
  { key: 'language', label: '국가', width: 'minmax(80px,1fr)' },
  { key: 'is_active', label: '상태', width: 'minmax(40px,1fr)' },
  { key: 'is_searchable', label: '검색', width: 'minmax(40px,1fr)' },
  { key: 'actions', label: '', width: 'minmax(140px,1fr)' },
];

const DemoProgramList: React.FC<DemoProgramListProps> = ({
  programs,
  selectedLang,
  onDeleted,
}) => {
  return (
    <DemoTableList
      data={programs}
      selectedLang={selectedLang}
      onDeleted={onDeleted}
      tableName='programs'
      detailPath='/demo/programs/detail'
      editPath='/demo/programs/edit'
      columnDefs={columnDefs}
    />
  );
};

export default DemoProgramList;
