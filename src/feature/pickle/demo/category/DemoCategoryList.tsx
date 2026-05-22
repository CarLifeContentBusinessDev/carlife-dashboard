import React from 'react';
import DemoTableList from '@/components/demo/DemoTableList';

interface DemoCategoryListProps {
  categories: any[];
  selectedLang: string;
  onDeleted?: () => void;
}

const columnDefs = [
  { key: 'id', label: 'id', width: 'minmax(40px,0.5fr)' },
  { key: 'title', label: 'title', width: 'minmax(80px,1.5fr)' },
  { key: 'img_url', label: 'thumbnail', width: 'minmax(80px,1fr)' },
  { key: 'order', label: '순서', width: 'minmax(40px,0.5fr)' },
  { key: 'language', label: 'language', width: 'minmax(100px,1.5fr)' },
  { key: 'programsCount', label: '프로그램 수', width: 'minmax(40px,1fr)' },
  { key: 'actions', label: '', width: 'minmax(140px,0.5fr)' },
];

const DemoCategoryList: React.FC<DemoCategoryListProps> = ({
  categories,
  selectedLang,
  onDeleted,
}) => {
  return (
    <DemoTableList
      data={categories}
      selectedLang={selectedLang}
      onDeleted={onDeleted}
      tableName='categories'
      detailPath='/demo/categories/detail'
      editPath='/demo/categories/edit'
      columnDefs={columnDefs}
    />
  );
};

export default DemoCategoryList;