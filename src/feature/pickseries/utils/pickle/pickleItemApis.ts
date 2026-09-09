import axios, { type AxiosInstance } from 'axios';

export function createPickleApi(token: string): AxiosInstance {
  const instance = axios.create({
    baseURL: import.meta.env.VITE_PROD_API_URL as string,
    headers: { Authorization: `Bearer ${token}` },
  });
  instance.interceptors.response.use((res) => {
    if ((res.data as { resultCode?: string })?.resultCode === 'E0123') {
      import('@/feature/pickseries/store/usePickSeriesServerStore').then(
        ({ usePickSeriesServerStore }) =>
          usePickSeriesServerStore.getState().clearServerToken('pickle-prod')
      );
      return Promise.reject(
        new Error('픽클 로그인이 만료되었습니다. 다시 로그인해주세요.')
      );
    }
    return res;
  });
  return instance;
}

export interface DateRange {
  fromDate: string; // yyyymmdd
  toDate: string; // yyyymmdd
}

interface UserDailyRow {
  date: string;
  memberCnt: number;
  guestCnt: number;
  newMemberCnt: number;
  newGuestCnt: number;
}
export async function fetchUserDaily(
  api: AxiosInstance,
  range: DateRange
): Promise<UserDailyRow[]> {
  const res = await api.get('/admin/stats/user-daily/search', {
    params: range,
  });
  return (res.data?.data ?? []) as UserDailyRow[];
}

interface UserWeeklyRow {
  startDate: string; // yyyymmdd
  endDate: string; // yyyymmdd
  activeMemberCnt: number;
  activeGuestCnt: number;
}
export async function fetchUserWeekly(
  api: AxiosInstance,
  range: DateRange
): Promise<UserWeeklyRow[]> {
  const res = await api.get('/admin/stats/user-weekly/search', {
    params: range,
  });
  return (res.data?.data ?? []) as UserWeeklyRow[];
}

interface HitHomeTabRow {
  tabName: string;
  hitCnt: number;
}
export async function fetchHitHomeTab(
  api: AxiosInstance,
  range: DateRange
): Promise<HitHomeTabRow[]> {
  const res = await api.get('/admin/stats/hit-home-tab/aggregation', {
    params: range,
  });
  return (res.data?.data ?? []) as HitHomeTabRow[];
}

export function weekRange(sheetDate: string): DateRange {
  const [y, m, d] = sheetDate.split('.').map(Number);
  const fmt = (dt: Date): string =>
    `${dt.getFullYear()}${String(dt.getMonth() + 1).padStart(2, '0')}${String(dt.getDate()).padStart(2, '0')}`;
  return {
    fromDate: fmt(new Date(y, m - 1, d)), // 월요일 (시트값)
    toDate: fmt(new Date(y, m - 1, d + 6)), // 일요일 (시작 + 6일)
  };
}
