import type { AxiosInstance } from 'axios';
import type { ProdFastRow } from '@/shared/types/pickleProdContents';
import { api } from '@/shared/utils/api/api';
import {
  enrichFastRows,
  fetchFastListItems,
} from '@/shared/utils/api/fetchAllFastData';
import { getExistingFastIds } from './updateFast';

export async function getNewFastData(
  setProgress: (message: string) => void,
  apiInstance: AxiosInstance = api,
  spreadsheetId?: string,
  sheetName?: string
): Promise<ProdFastRow[]> {
  const existingIds = await getExistingFastIds(
    spreadsheetId || import.meta.env.VITE_SPREADSHEET_ID,
    sheetName
  );

  const listItems = await fetchFastListItems(apiInstance);
  const newItems = listItems.filter((item) => !existingIds.has(item.fastId));

  if (newItems.length === 0) return [];

  return enrichFastRows(newItems, apiInstance, undefined, setProgress);
}
