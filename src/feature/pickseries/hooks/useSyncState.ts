import { useState } from 'react';

export type SyncPreviewMode = 'new' | 'all' | null;

export const SYNC_PAGE_SIZE = 10;

export function useSyncState() {
  const [syncPreviewMode, setSyncPreviewMode] = useState<SyncPreviewMode>(null);
  const [syncPage, setSyncPage] = useState(1);
  const [syncTotalPages, setSyncTotalPages] = useState(0);

  const handleSyncPageChange = (page: number) => {
    setSyncPage(page);
  };

  const initSyncPreview = (dataLength: number, mode: 'new' | 'all') => {
    setSyncPage(1);
    setSyncTotalPages(Math.ceil(dataLength / SYNC_PAGE_SIZE));
    setSyncPreviewMode(mode);
  };

  const resetSync = () => {
    setSyncPreviewMode(null);
    setSyncPage(1);
    setSyncTotalPages(0);
  };

  return {
    syncPreviewMode,
    setSyncPreviewMode,
    syncPage,
    setSyncPage,
    syncTotalPages,
    setSyncTotalPages,
    handleSyncPageChange,
    initSyncPreview,
    resetSync,
  };
}
