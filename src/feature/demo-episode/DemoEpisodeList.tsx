import React from 'react';
import DemoTableList from '../../components/demo/DemoTableList';

interface DemoEpisodeListProps {
  episodes: any[];
  selectedLang: string;
  onDeleted?: () => void;
}

const columnDefs = [
  { key: 'id', label: 'ID', width: 'minmax(40px,0.5fr)' },
  { key: 'title', label: 'title', width: 'minmax(80px,3fr)' },
  { key: 'programs.title', label: '프로그램', width: 'minmax(80px,2fr)' },
  { key: 'date', label: '날짜', width: 'minmax(80px,0.8fr)' },
  { key: 'duration', label: '길이', width: 'minmax(80px,0.8fr)' },
  { key: 'is_active', label: '상태', width: 'minmax(80px,1fr)' },
  { key: 'is_searchable', label: '검색', width: 'minmax(80px,1fr)' },
  { key: 'language', label: '국가', width: 'minmax(80px,0.5fr)' },
  { key: 'actions', label: '', width: 'minmax(140px,1fr)' },
];

const columns = columnDefs.map(({ key, label }) => ({ key, label }));
const gridCols = columnDefs.map(({ width }) => width).join(' ');

const DemoEpisodeList: React.FC<DemoEpisodeListProps> = ({
  episodes,
  selectedLang,
  onDeleted,
}) => {
  return (
    <DemoTableList
      data={episodes}
      selectedLang={selectedLang}
      onDeleted={onDeleted}
      tableName='episodes'
      detailPath='/demo/episode/detail'
      editPath='/demo/episode'
      columns={columns}
      gridCols={gridCols}
    />
  );
};

export default DemoEpisodeList;
