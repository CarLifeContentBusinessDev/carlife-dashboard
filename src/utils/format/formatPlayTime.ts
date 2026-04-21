export function formatPlayTime(seconds: number | string): string {
  const totalSeconds = typeof seconds === 'string' ? parseInt(seconds, 10) : seconds;

  if (isNaN(totalSeconds) || totalSeconds < 0) {
    return '0시간 0분 0초';
  }

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  return `${hours}시간 ${minutes}분 ${secs}초`;
}

export function parsePlayTime(timeString: string | number): number {
  if (typeof timeString === 'number') {
    return timeString;
  }

  if (!timeString || timeString.trim() === '') {
    return 0;
  }

  const numericValue = parseInt(timeString, 10);
  if (!isNaN(numericValue) && timeString.trim() === numericValue.toString()) {
    return numericValue;
  }

  const timeRegex = /(\d+)시\s*(\d+)분\s*(\d+)초/;
  const match = timeString.match(timeRegex);

  if (match) {
    const hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const seconds = parseInt(match[3], 10);

    return hours * 3600 + minutes * 60 + seconds;
  }

  return 0;
}
