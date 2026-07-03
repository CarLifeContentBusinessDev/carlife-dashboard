import Button from '@/shared/components/common/Button';
import LoadingOverlay from '@/shared/components/common/LoadingOverlay';
import type { SyncPreviewMode } from '@/feature/pickseries/hooks/useSyncState';

interface SyncToolbarProps {
  onSearchNew: () => void;
  onLoadAll: () => void;
  excelHref: string;
  onSync: () => void;
  loading: boolean;
  excelLoading: boolean;
  progress: string;
  syncPreviewMode: SyncPreviewMode;
}

const SyncToolbar = ({
  onSearchNew,
  onLoadAll,
  excelHref,
  onSync,
  loading,
  excelLoading,
  progress,
  syncPreviewMode,
}: SyncToolbarProps) => (
  <div className='flex justify-between items-center gap-2 mb-4 shrink-0'>
    <div className='flex gap-2 items-center'>
      <Button onClick={onSearchNew} disabled={excelLoading || loading}>
        신규 조회
      </Button>
      <Button onClick={onLoadAll} disabled={excelLoading || loading}>
        전체 조회
      </Button>
      <Button href={excelHref} target='_blank' rel='noopener noreferrer'>
        Excel 바로가기
      </Button>
    </div>
    <div className='flex gap-2 items-center'>
      <LoadingOverlay
        progress={progress}
        vertical={false}
        loading={excelLoading || loading}
      />
      <Button
        onClick={onSync}
        disabled={!syncPreviewMode || excelLoading || loading}
      >
        동기화 실행
      </Button>
    </div>
  </div>
);

export default SyncToolbar;
