import React from 'react';
import DemoTableList from '../../components/DemoTableList';

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

const columns = columnDefs.map(({ key, label }) => ({ key, label }));
const gridCols = columnDefs.map(({ width }) => width).join(' ');

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
      detailPath='/demo/category/detail'
      editPath='/demo/category'
      columns={columns}
      gridCols={gridCols}
    />
  );
};

export default DemoCategoryList;
