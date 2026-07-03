import type {
  ListPayload,
  PagedListResponse,
} from '@/shared/utils/googleSheets/syncPicknowConfigurationSheet.types';
import type { AxiosInstance } from 'axios';

export const extractList = <T>(
  payload: ListPayload<T> | null | undefined
): T[] => {
  if (Array.isArray(payload)) return payload;
  if (!payload) return [];

  const list =
    payload.dataList ??
    payload.items ??
    payload.list ??
    payload.content ??
    payload.rows;

  return Array.isArray(list) ? list : [];
};

export const fetchAllPagedList = async <T>(
  apiInstance: AxiosInstance,
  url: string,
  params?: Record<string, string | number>
): Promise<T[]> => {
  const firstResponse = await apiInstance.get<PagedListResponse<T>>(url, {
    params: { ...params, page: 1, size: 1000 },
  });

  const firstData = firstResponse.data.data;
  const firstList = extractList(firstData);
  const totalCount = firstData?.pageInfo?.totalCount ?? firstList.length;

  if (totalCount <= firstList.length) {
    return firstList;
  }

  const pageSize = firstData?.pageInfo?.size || firstList.length || 1000;

  const totalPages = Math.ceil(totalCount / pageSize);
  const remainingPages = Array.from(
    { length: Math.max(totalPages - 1, 0) },
    (_, index) => index + 2
  );

  const remainingResults = await Promise.all(
    remainingPages.map(async (page) => {
      const response = await apiInstance.get<PagedListResponse<T>>(url, {
        params: { ...params, page, size: pageSize },
      });
      return extractList(response.data.data);
    })
  );

  return firstList.concat(...remainingResults);
};
