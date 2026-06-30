import type { SyncPreviewMode } from '@/feature/pickseries/hooks/useSyncState';

interface SyncCountHeaderProps {
  syncPreviewMode: SyncPreviewMode;
  newCount: number;
  allCount: number;
}

const SyncCountHeader = ({
  syncPreviewMode,
  newCount,
  allCount,
}: SyncCountHeaderProps) => (
  <h3 className='text-point-color font-semibold'>
    {syncPreviewMode === 'all' && (
      <>
        전체 동기화 대상 총 <span className='font-extrabold'>{allCount}</span>개
      </>
    )}
    {syncPreviewMode === 'new' && (
      <>
        신규 동기화 대상 총 <span className='font-extrabold'>{newCount}</span>개
      </>
    )}
    {syncPreviewMode === null && (
      <>신규/전체 조회 후 결과를 확인하고 동기화를 실행하세요.</>
    )}
  </h3>
);

export default SyncCountHeader;
