import { supabase } from '../../lib/supabase';

interface FetchAllSupabaseRowsOptions {
  table: string;
  select?: string;
  orderColumn?: string;
  ascending?: boolean;
  pageSize?: number;
}

export default async function fetchAllSupabaseRows<T>({
  table,
  select = '*',
  orderColumn = 'id',
  ascending = true,
  pageSize = 1000,
}: FetchAllSupabaseRowsOptions): Promise<T[]> {
  const allRows: T[] = [];
  let from = 0;

  while (true) {
    let query = supabase
      .from(table)
      .select(select)
      .range(from, from + pageSize - 1);

    if (orderColumn) {
      query = query.order(orderColumn, { ascending });
    }

    const { data, error } = await query;
    if (error) throw error;

    const batch = (data || []) as T[];
    allRows.push(...batch);

    if (batch.length < pageSize) {
      break;
    }

    from += pageSize;
  }

  return allRows;
}
