import React from 'react';
import DemoTableList from '@/feature/pickle-demo/components/DemoTableList';

interface DemoThemeListProps {
  themes: any[];
  selectedLang: string;
  onDeleted?: () => void;
}

const columnDefs = [
  { key: 'id', label: 'ID', width: 'minmax(40px,0.5fr)' },
  { key: 'title', label: 'title', width: 'minmax(80px,2fr)' },
  { key: 'subtitle', label: 'subtitle', width: 'minmax(80px,2fr)' },
  { key: 'sections.title', label: '섹션', width: 'minmax(80px,1.5fr)' },
  { key: 'order', label: '순서', width: 'minmax(40px,0.5fr)' },
  { key: 'language', label: '국가', width: 'minmax(40px,0.5fr)' },
  { key: 'is_active', label: '상태', width: 'minmax(40px,0.8fr)' },
  { key: 'is_searchable', label: '검색', width: 'minmax(40px,0.8fr)' },
  { key: 'actions', label: '', width: 'minmax(140px,1fr)' },
];

const DemoThemeList: React.FC<DemoThemeListProps> = ({
  themes,
  selectedLang,
  onDeleted,
}) => {
  return (
    <DemoTableList
      data={themes}
      selectedLang={selectedLang}
      onDeleted={onDeleted}
      tableName='themes'
      detailPath='/pickle/demo/themes/detail'
      editPath='/pickle/demo/themes/edit'
      columnDefs={columnDefs}
    />
  );
};

export default DemoThemeList;
