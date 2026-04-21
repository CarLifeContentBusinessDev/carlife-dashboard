const formatDateString = (dateStr?: string) => {
  if (!dateStr) return '';

  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';

  const korTime = new Date(date.getTime() + 9 * 60 * 60 * 1000);

  const yyyy = korTime.getUTCFullYear();
  const mm = String(korTime.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(korTime.getUTCDate()).padStart(2, '0');
  const hh = String(korTime.getUTCHours()).padStart(2, '0');
  const min = String(korTime.getUTCMinutes()).padStart(2, '0');
  const sec = String(korTime.getUTCSeconds()).padStart(2, '0');

  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${sec}`;
};

export default formatDateString;
