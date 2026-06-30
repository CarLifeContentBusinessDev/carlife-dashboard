export interface ProductGroup {
  id: string;
  label: string;
  tabName: string;
  serverIds: string[];
  excludedItems?: string[];
}

export interface ProductState<TData> {
  data: TData | null;
  loading: boolean;
  error: string | null;
}

export type OEMSelection = Record<string, Record<string, Set<string>>>;

export type ExtractionStatus = 'idle' | 'running' | 'done' | 'error';
