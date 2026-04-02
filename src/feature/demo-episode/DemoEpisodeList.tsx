import React from 'react';
import DemoTableList from '../../components/DemoTableList';

interface DemoEpisodeListProps {
  episodes: any[];
  selectedLang: string;
  onDeleted?: () => void;
}

const gridCols =
  'minmax(40px,0.5fr) minmax(80px,3fr) minmax(80px,2fr) minmax(80px,0.8fr) minmax(80px,0.8fr) minmax(80px,1fr) minmax(80px,1fr) minmax(80px,0.5fr) minmax(140px,1fr)';

const columns = [
  { key: 'id', label: 'ID' },
  { key: 'title', label: 'title' },
  { key: 'programs.title', label: '프로그램' },
  { key: 'date', label: '날짜' },
  { key: 'duration', label: '길이' },
  { key: 'is_active', label: 'Status' },
  { key: 'is_searchable', label: 'Searchable' },
  { key: 'language', label: '국가' },
  { key: 'actions', label: '' },
];

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
