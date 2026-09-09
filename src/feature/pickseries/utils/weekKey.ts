// 서비스별 주차 시작 요일이 달라도(픽클 월요일, 픽조이 일요일) 같은 논리적 주차로
// 묶기 위한 정규 키. 각 날짜를 "가장 가까운 월요일"의 'YYYY.MM.DD' 로 정규화한다.
//  - 픽클  월요일 2026.09.07 → 2026.09.07
//  - 픽조이 일요일 2026.09.06 → 2026.09.07
export function weekKeyOf(dateStr: string): string {
  const [y, m, d] = dateStr.split('.').map(Number);
  const dt = new Date(y, m - 1, d);
  const dow = dt.getDay(); // 0=일 ... 6=토
  const toMonday = (dow + 6) % 7; // 이번 주 월요일까지 뒤로 갈 일수
  const shift = toMonday === 0 ? 0 : toMonday <= 3 ? -toMonday : 7 - toMonday;
  dt.setDate(dt.getDate() + shift);
  return `${dt.getFullYear()}.${String(dt.getMonth() + 1).padStart(2, '0')}.${String(dt.getDate()).padStart(2, '0')}`;
}

// canonicalKey → 해당 서비스 시트의 실제 시작일
export function buildWeekMap(dates: string[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const d of dates) map.set(weekKeyOf(d), d);
  return map;
}
