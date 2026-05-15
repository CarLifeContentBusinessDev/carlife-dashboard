import React from 'react';
import DemoTableList from '@/components/demo/DemoTableList';

interface DemoSeriesListProps {
  series: any[];
  selectedLang: string;
  onDeleted?: () => void;
}

const columnDefs = [
  { key: 'id', label: 'ID', width: 'minmax(40px,0.5fr)' },
  { key: 'img_url', label: '썸네일', width: 'minmax(80px,1fr)' },
  { key: 'title', label: 'title', width: 'minmax(80px,2fr)' },
  { key: 'subtitle', label: 'subtitle', width: 'minmax(80px,2fr)' },
  { key: 'language', label: '국가', width: 'minmax(40px,0.5fr)' },
  { key: 'sections.title', label: '섹션', width: 'minmax(40px,1fr)' },
  { key: 'order', label: '순서', width: 'minmax(40px,0.5fr)' },
  { key: 'is_active', label: '상태', width: 'minmax(40px,0.8fr)' },
  { key: 'is_searchable', label: '검색', width: 'minmax(40px,0.8fr)' },
  { key: 'actions', label: '', width: 'minmax(140px,1fr)' },
];

const DemoSeriesList: React.FC<DemoSeriesListProps> = ({
  series,
  selectedLang,
  onDeleted,
}) => {
  return (
    <DemoTableList
      data={series}
      selectedLang={selectedLang}
      onDeleted={onDeleted}
      tableName='series'
      detailPath='/demo/series/detail'
      editPath='/demo/series'
      columnDefs={columnDefs}
    />
  );
};

export default DemoSeriesList;
