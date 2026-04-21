interface SyncEmptyStateProps {
  loading: boolean;
  syncPreviewMode: boolean;
}

export const SyncEmptyState = ({
  loading,
  syncPreviewMode,
}: SyncEmptyStateProps) => {
  return (
    <>
      {!loading && !syncPreviewMode && (
        <div className='flex items-center justify-center h-full text-gray-500'>
          신규/전체 조회를 먼저 실행해주세요.
        </div>
      )}
    </>
  );
};
