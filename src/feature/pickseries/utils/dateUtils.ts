// 주차 종료일(시작+6일)이 오늘보다 이전인 경우만 선택 가능
export function isDateSelectable(date: string): boolean {
  const parts = date.split('.');
  if (parts.length < 3) return false;
  const [year, month, day] = parts.map(Number);
  if (!year || !month || !day) return false;
  const weekEnd = new Date(year, month - 1, day + 6);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return weekEnd < today;
}
