export interface PicknowServer {
  id: string;
  label: string;
  apiUrl: string;
  spreadsheetId: string;
  publicKey: string;
}

export const picknowTokenKey = (id: string) => `picknow_token_${id}`;
export const picknowRefreshKey = (id: string) => `picknow_refresh_${id}`;

export const PICKNOW_SERVERS: PicknowServer[] = [
  {
    id: 'stg',
    label: 'STG',
    apiUrl: import.meta.env.VITE_PICKNOW_API_URL_STG as string,
    spreadsheetId: import.meta.env.VITE_PICKNOW_SPREADSHEET_ID_STG as string,
    publicKey: `-----BEGIN PUBLIC KEY-----\n${import.meta.env.VITE_PICKNOW_PUBLIC_KEY_STG as string}\n-----END PUBLIC KEY-----`,
  },
  {
    id: 'kr-demo',
    label: 'KR Demo',
    apiUrl: import.meta.env.VITE_PICKNOW_API_URL_KR_DEMO as string,
    spreadsheetId: import.meta.env
      .VITE_PICKNOW_SPREADSHEET_ID_KR_DEMO as string,
    publicKey: `-----BEGIN PUBLIC KEY-----\n${import.meta.env.VITE_PICKNOW_PUBLIC_KEY_KR_DEMO as string}\n-----END PUBLIC KEY-----`,
  },
];
