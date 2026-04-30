export interface MenuChild {
  id: string;
  to: string;
  label: string;
  icon?: React.ReactNode;
  openInNewTab?: boolean;
}

export type MenuGroup =
  | {
      id: string;
      label: string;
      icon: React.ReactNode;
      children: MenuChild[];
      to?: never;
      openInNewTab?: never;
    }
  | {
      id: string;
      label: string;
      icon: React.ReactNode;
      to: string;
      children?: never;
      openInNewTab?: boolean;
    };

export const PICKLE_MENU_GROUPS: MenuGroup[] = [
  {
    id: 'data-management',
    label: '상용 콘텐츠 관리',
    icon: (
      <img src='/radio.svg' width={24} height={24} alt='상용 콘텐츠 관리' />
    ),
    children: [
      {
        id: 'episode',
        to: '/episode-list',
        label: '에피소드 관리',
      },
      {
        id: 'channel-book-list',
        to: '/channel-book-list',
        label: '채널·도서 관리',
      },
      {
        id: 'curation-list',
        to: '/curation-list',
        label: '큐레이션 관리',
      },
      {
        id: 'stg_episode',
        to: '/stg/episode-list',
        label: '에피소드 관리 (stg)',
      },
      {
        id: 'stg_channel-book-list',
        to: '/stg/channel-book-list',
        label: '채널·도서 관리 (stg)',
      },
      {
        id: 'stg_curation-list',
        to: '/stg/curation-list',
        label: '큐레이션 관리 (stg)',
      },
    ],
  },
  {
    id: 'demo-data-management',
    label: '데모 콘텐츠 관리',
    icon: (
      <img
        src='/radio-fill.svg'
        width={24}
        height={24}
        alt='데모 콘텐츠 관리'
      />
    ),
    children: [
      { id: 'programs', to: '/demo/program', label: '프로그램 관리' },
      { id: 'episodes', to: '/demo/episode', label: '에피소드 관리' },
      { id: 'series', to: '/demo/series', label: '시리즈 관리' },
      { id: 'themes', to: '/demo/theme', label: '테마 관리' },
      { id: 'categories', to: '/demo/category', label: '카테고리 관리' },
      {
        id: 'broadcastings',
        to: '/demo/broadcasting',
        label: '방송사 관리',
      },
    ],
  },
  {
    id: 'prod-admin',
    label: '상용 어드민 바로가기',
    icon: (
      <img
        src='/admin-line.svg'
        width={24}
        height={24}
        alt='상용 어드민 바로가기'
      />
    ),
    to: import.meta.env.VITE_ADMIN_EPI_URL,
    openInNewTab: true,
  },
  {
    id: 'stg-admin',
    label: '검증 어드민 바로가기',
    icon: (
      <img
        src='/admin-fill.svg'
        width={24}
        height={24}
        alt='검증 어드민 바로가기'
      />
    ),
    to: import.meta.env.VITE_ADMIN_EPI_URL_STG,
    openInNewTab: true,
  },
];

export const PICKNOW_MENU_GROUPS: MenuGroup[] = [
  {
    id: 'excel-sync',
    label: '엑셀 데이터 동기화',
    icon: (
      <img src='/excel.svg' width={24} height={24} alt='엑셀 데이터 동기화' />
    ),
    to: '/picknow/excel-sync',
  },
];
