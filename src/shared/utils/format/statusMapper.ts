export function mapCurationStatus(status: string): string {
  switch (status) {
    case 'ACTIVE':
      return '게시 중';
    case 'ACTIVE_NONE_DISPLAY':
      return '게시 대기';
    case 'INACTIVE':
      return '게시 종료';
    case 'WAITING':
      return '게시 예약';
    default:
      return status;
  }
}
