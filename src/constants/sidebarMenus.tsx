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
        id: 'episodes',
        to: '/pickle/episodes',
        label: '에피소드 관리',
      },
      {
        id: 'channels',
        to: '/pickle/channels',
        label: '채널·도서 관리',
      },
      {
        id: 'curations',
        to: '/pickle/curations',
        label: '큐레이션 관리',
      },
      {
        id: 'stg_episodes',
        to: '/pickle/stg/episodes',
        label: '에피소드 관리 (stg)',
      },
      {
        id: 'stg_channels',
        to: '/pickle/ stg/channels',
        label: '채널·도서 관리 (stg)',
      },
      {
        id: 'stg_curations',
        to: '/pickle/stg/curations',
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
      { id: 'programs', to: '/pickle/demo/programs', label: '프로그램 관리' },
      { id: 'episodes', to: '/pickle/demo/episodes', label: '에피소드 관리' },
      { id: 'series', to: '/pickle/demo/series', label: '시리즈 관리' },
      { id: 'themes', to: '/pickle/demo/themes', label: '테마 관리' },
      {
        id: 'categories',
        to: '/pickle/demo/categories',
        label: '카테고리 관리',
      },
      {
        id: 'broadcastings',
        to: '/pickle/demo/broadcastings',
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
    label: 'Configuration 데이터 추출',
    icon: <img src='/excel.svg' width={24} height={24} alt='엑셀' />,
    to: '/picknow/excel-sync',
  },
  {
    id: 'picknow-admin-router',
    label: '어드민 바로가기',
    icon: (
      <img src='/admin-fill.svg' width={24} height={24} alt='어드민 바로가기' />
    ),
    children: (() => {
      const ensureAdminLoginPath = (base?: string) => {
        if (!base) return '';
        // 이미 admin 웹 또는 로그인 해시가 포함돼 있으면 그대로 리턴
        if (/admin-web|#\/login/.test(base)) return base;
        try {
          // 정상적인 URL이면 origin을 사용해 admin 경로를 붙임
          const u = new URL(base);
          return `${u.origin}/admin-web/#/login`;
        } catch {
          // URL 파싱 실패 시 단순히 슬래시를 정리하고 붙임
          return `${base.replace(/\/$/, '')}/admin-web/#/login`;
        }
      };

      return [
        {
          id: 'picknow-stg',
          to: ensureAdminLoginPath(
            import.meta.env.VITE_PICKNOW_ADMIN_EPI_URL_STG
          ),
          label: '검증 서버',
        },
        {
          id: 'picknow-kr-demo',
          to: ensureAdminLoginPath(
            import.meta.env.VITE_PICKNOW_API_URL_KR_DEMO
          ),
          label: 'KR-DEMO 서버',
        },
        {
          id: 'picknow-kr-prod-kia',
          to: ensureAdminLoginPath(
            import.meta.env.VITE_PICKNOW_API_URL_KR_PROD_KIA
          ),
          label: '상용 한국 서버 - KIA',
        },
        {
          id: 'picknow-kr-prod',
          to: ensureAdminLoginPath(
            import.meta.env.VITE_PICKNOW_API_URL_KR_PROD
          ),
          label: '상용 한국 서버 - MOTREX, KGM',
        },
        {
          id: 'picknow-na-prod',
          to: ensureAdminLoginPath(import.meta.env.VITE_PICKNOW_API_URL_US),
          label: '상용 북미 서버 - MOTREX',
        },
      ];
    })(),
  },
];

export const PICKSERIES_MENU_GROUPS: MenuGroup[] = [
  {
    id: 'picksereis-operation-data',
    label: '운영 데이터 추출',
    icon: <img src='/excel.svg' width={24} height={24} alt='엑셀' />,
    children: [
      {
        id: 'pickseries-weekly-data',
        to: '/pickseries/operation/weekly',
        label: '주간지표',
      },
      {
        id: 'pickseries-operation-data',
        to: '/pickseries/operation/oem',
        label: 'OEM지표',
      },
    ],
  },
];
