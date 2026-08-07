// 픽클
export interface PickleServer {
  id: string;
  label: string;
  apiUrl: string;
}

export const pickleTokenKey = (id: string) => `pickle_token_${id}`;
export const pickleRefreshKey = (id: string) => `pickle_refresh_${id}`;

export const PICKLE_SERVERS: PickleServer[] = [
  {
    id: 'pickle-prod',
    label: '상용',
    apiUrl: import.meta.env.VITE_PROD_API_URL as string,
  },
  {
    id: 'pickle-stg',
    label: 'STG',
    apiUrl: import.meta.env.VITE_STG_API_URL as string,
  },
  {
    id: 'pickle-web-demo',
    label: '웹데모',
    apiUrl: '',
  },
];

// 픽나우
export interface PicknowServer {
  id: string;
  label: string;
  apiUrl: string;
  spreadsheetId?: string;
  publicKey?: string;
  isActive?: boolean;
}

export const picknowTokenKey = (id: string) => `picknow_token_${id}`;
export const picknowRefreshKey = (id: string) => `picknow_refresh_${id}`;

export const PICKNOW_SERVERS: PicknowServer[] = [
  // 검증서버
  {
    id: 'picknow-stg-kr',
    label: '한국',
    apiUrl: import.meta.env.VITE_PICKNOW_API_URL_STG_KR as string,
    spreadsheetId: import.meta.env.VITE_PICKNOW_SPREADSHEET_ID_STG as string,
    publicKey: `-----BEGIN PUBLIC KEY-----\n${import.meta.env.VITE_PICKNOW_PUBLIC_KEY as string}\n-----END PUBLIC KEY-----`,
    isActive: true,
  },
  {
    id: 'picknow-stg-in',
    label: '인도',
    apiUrl: import.meta.env.VITE_PICKNOW_API_URL_STG_IN as string,
    spreadsheetId: import.meta.env.VITE_PICKNOW_SPREADSHEET_ID_STG as string,
    publicKey: `-----BEGIN PUBLIC KEY-----\n${import.meta.env.VITE_PICKNOW_PUBLIC_KEY as string}\n-----END PUBLIC KEY-----`,
    isActive: true,
  },
  // 데모 서버
  {
    id: 'picknow-demo-kr',
    label: '한국',
    apiUrl: import.meta.env.VITE_PICKNOW_API_URL_KR_DEMO as string,
    spreadsheetId: import.meta.env.VITE_PICKNOW_SPREADSHEET_ID_DEMO as string,
    publicKey: `-----BEGIN PUBLIC KEY-----\n${import.meta.env.VITE_PICKNOW_PUBLIC_KEY as string}\n-----END PUBLIC KEY-----`,
    isActive: true,
  },
  {
    id: 'picknow-demo-us',
    label: '북미',
    apiUrl: import.meta.env.VITE_PICKNOW_API_URL_US_DEMO as string,
    spreadsheetId: import.meta.env.VITE_PICKNOW_SPREADSHEET_ID_DEMO as string,
    publicKey: `-----BEGIN PUBLIC KEY-----\n${import.meta.env.VITE_PICKNOW_PUBLIC_KEY as string}\n-----END PUBLIC KEY-----`,
    isActive: true,
  },
  {
    id: 'picknow-demo-eu',
    label: '유럽',
    apiUrl: import.meta.env.VITE_PICKNOW_API_URL_EU_DEMO as string,
    spreadsheetId: import.meta.env.VITE_PICKNOW_SPREADSHEET_ID_DEMO as string,
    publicKey: `-----BEGIN PUBLIC KEY-----\n${import.meta.env.VITE_PICKNOW_PUBLIC_KEY as string}\n-----END PUBLIC KEY-----`,
    isActive: true,
  },
  {
    id: 'picknow-demo-au',
    label: '호주',
    apiUrl: import.meta.env.VITE_PICKNOW_API_URL_AU_DEMO as string,
    spreadsheetId: import.meta.env.VITE_PICKNOW_SPREADSHEET_ID_DEMO as string,
    publicKey: `-----BEGIN PUBLIC KEY-----\n${import.meta.env.VITE_PICKNOW_PUBLIC_KEY as string}\n-----END PUBLIC KEY-----`,
    isActive: true,
  },
  {
    id: 'picknow-demo-sg',
    label: '싱가폴(인도)',
    apiUrl: import.meta.env.VITE_PICKNOW_API_URL_SG_DEMO as string,
    spreadsheetId: import.meta.env.VITE_PICKNOW_SPREADSHEET_ID_DEMO as string,
    publicKey: `-----BEGIN PUBLIC KEY-----\n${import.meta.env.VITE_PICKNOW_PUBLIC_KEY as string}\n-----END PUBLIC KEY-----`,
    isActive: false,
  },

  // 상용 서버
  {
    id: 'picknow-prod-kr-kia',
    label: '한국 PV5',
    apiUrl: import.meta.env.VITE_PICKNOW_API_URL_KR_PROD_KIA as string,
    spreadsheetId: import.meta.env.VITE_PICKNOW_SPREADSHEET_ID_PROD as string,
    publicKey: `-----BEGIN PUBLIC KEY-----\n${import.meta.env.VITE_PICKNOW_PUBLIC_KEY as string}\n-----END PUBLIC KEY-----`,
    isActive: true,
  },
  {
    id: 'picknow-prod-kr',
    label: '한국',
    apiUrl: import.meta.env.VITE_PICKNOW_API_URL_KR_PROD as string,
    spreadsheetId: import.meta.env.VITE_PICKNOW_SPREADSHEET_ID_PROD as string,
    publicKey: `-----BEGIN PUBLIC KEY-----\n${import.meta.env.VITE_PICKNOW_PUBLIC_KEY as string}\n-----END PUBLIC KEY-----`,
    isActive: true,
  },
  {
    id: 'picknow-prod-us',
    label: '상용 북미 - MOTREX',
    apiUrl: import.meta.env.VITE_PICKNOW_API_URL_US_PROD as string,
    spreadsheetId: import.meta.env
      .VITE_PICKNOW_SPREADSHEET_ID_US_PROD as string,
    publicKey: `-----BEGIN PUBLIC KEY-----\n${import.meta.env.VITE_PICKNOW_PUBLIC_KEY as string}\n-----END PUBLIC KEY-----`,
    isActive: false,
  },
  {
    id: 'picknow-prod-sg',
    label: '상용 싱가포르(인도)',
    apiUrl: import.meta.env.VITE_PICKNOW_API_URL_SG_PROD as string,
    spreadsheetId: import.meta.env
      .VITE_PICKNOW_SPREADSHEET_ID_SG_PROD as string,
    publicKey: `-----BEGIN PUBLIC KEY-----\n${import.meta.env.VITE_PICKNOW_PUBLIC_KEY as string}\n-----END PUBLIC KEY-----`,
    isActive: false,
  },
];

// 픽시리즈
export interface PickSeriesServer {
  id: string;
  label: string;
  apiUrl: string;
  spreadsheetId?: string;
  publicKey?: string;
  isActive?: boolean;
}

export const pickSeriesTokenKey = (id: string) => `pickSeries_token_${id}`;
export const pickSeriesRefreshKey = (id: string) => `pickSeries_refresh_${id}`;

export const PICKSERIES_SERVERS: PickSeriesServer[] = [
  {
    id: 'pickle-prod',
    label: 'Pickle',
    apiUrl: import.meta.env.VITE_PROD_API_URL as string,
    isActive: false,
  },
  {
    id: 'picknow-kr-prod-kia',
    label: 'Picknow 한국 - KIA',
    apiUrl: import.meta.env.VITE_PICKNOW_API_URL_KR_PROD_KIA as string,
    spreadsheetId: import.meta.env
      .VITE_PICKNOW_SPREADSHEET_ID_KR_PROD_KIA as string,
    publicKey: `-----BEGIN PUBLIC KEY-----\n${import.meta.env.VITE_PICKNOW_PUBLIC_KEY as string}\n-----END PUBLIC KEY-----`,
    isActive: false,
  },
  {
    id: 'picknow-kr-prod',
    label: 'Picknow 한국',
    apiUrl: import.meta.env.VITE_PICKNOW_API_URL_KR_PROD as string,
    spreadsheetId: import.meta.env
      .VITE_PICKNOW_SPREADSHEET_ID_KR_PROD as string,
    publicKey: `-----BEGIN PUBLIC KEY-----\n${import.meta.env.VITE_PICKNOW_PUBLIC_KEY as string}\n-----END PUBLIC KEY-----`,
    isActive: false,
  },
  {
    id: 'picknow-us-prod',
    label: 'Picknow 북미',
    apiUrl: import.meta.env.VITE_PICKNOW_API_URL_US_PROD as string,
    spreadsheetId: import.meta.env
      .VITE_PICKNOW_SPREADSHEET_ID_US_PROD as string,
    publicKey: `-----BEGIN PUBLIC KEY-----\n${import.meta.env.VITE_PICKNOW_PUBLIC_KEY as string}\n-----END PUBLIC KEY-----`,
    isActive: false,
  },
  {
    id: 'picknow-in-prod',
    label: 'Picknow 싱가포르(인도)',
    apiUrl: import.meta.env.VITE_PICKNOW_API_URL_SG_PROD as string,
    spreadsheetId: import.meta.env
      .VITE_PICKNOW_SPREADSHEET_ID_IN_PROD as string,
    publicKey: `-----BEGIN PUBLIC KEY-----\n${import.meta.env.VITE_PICKNOW_PUBLIC_KEY as string}\n-----END PUBLIC KEY-----`,
    isActive: false,
  },
  {
    id: 'pickjoy',
    label: 'Pickjoy',
    apiUrl: import.meta.env.VITE_PICKJOY_API_URL as string,
    isActive: true,
  },
];
