import { useLocation } from 'react-router-dom';
import { api, stgApi } from '../utils/api/api';

export function useStagingEnv() {
  const { pathname } = useLocation();
  const isStaging = pathname.startsWith('/stg');
  const apiInstance = isStaging ? stgApi : api;
  const spreadsheetId = isStaging
    ? import.meta.env.VITE_STG_SPREADSHEET_ID
    : import.meta.env.VITE_SPREADSHEET_ID;

  return { isStaging, apiInstance, spreadsheetId };
}
