import DemoEntityDetail from '../../components/demo/DemoEntityDetail';

const EPISODE_FIELD_LABELS = {
  id: 'ID',
  title: '제목',
  type: '유형',
  programs: '프로그램',
  program_id: '프로그램 ID',
  img_url: '썸네일',
  date: '게시일',
  duration: '재생 시간',
  language: '국가',
  audio_file: '오디오 파일',
  audioFile_dubbing: '더빙 오디오 파일',
  order: '순위',
  created_at: '생성일',
  is_active: 'status',
  is_searchable: 'searchable',
  sub_title: 'AI 음악 부제',
  theme_color: 'AI 음악 테마 색상',
} as const;

const EPISODE_FIELD_ORDER = [
  'id',
  'title',
  'type',
  'programs',
  'program_id',
  'img_url',
  'date',
  'duration',
  'language',
  'audio_file',
  'audioFile_dubbing',
  'order',
  'created_at',
  'is_active',
  'is_searchable',
  'sub_title',
  'theme_color',
];

const EPISODE_SUMMARY_FIELDS = [
  { key: 'created_at', label: '생성일' },
  { key: 'id', label: '에피소드 ID' },
  { key: 'duration', label: '재생 시간' },
];

const EPISODE_HIDDEN_FIELDS = [
  'is_live',
  'listen_count',
  'listened_at',
  'listened_duration',
  'order_recent',
  'recent_series_id',
];

const DemoEpisodeDetail = () => {
  return (
    <DemoEntityDetail
      parentMenu='데모 콘텐츠 관리'
      childMenu='에피소드 상세'
      tableName='episodes'
      listPath='/demo/episode'
      editPath='/demo/episode'
      select='*, programs(title)'
      fieldLabels={EPISODE_FIELD_LABELS}
      fieldOrder={EPISODE_FIELD_ORDER}
      summaryFields={EPISODE_SUMMARY_FIELDS}
      hiddenFields={EPISODE_HIDDEN_FIELDS}
    />
  );
};

export default DemoEpisodeDetail;
