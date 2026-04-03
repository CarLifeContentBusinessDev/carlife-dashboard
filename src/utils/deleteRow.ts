import { supabase } from '../lib/supabase';

export type DeleteRowResult =
  | { success: true }
  | {
      success: false;
      message: string;
      isRlsError?: boolean;
      stage?: 'mapping' | 'delete';
    };

export async function deleteRow(
  table: string,
  id: number
): Promise<DeleteRowResult> {
  // 시리즈/테마는 조인 테이블 매핑을 먼저 지워야 FK/RLS 충돌을 피할 수 있습니다.
  if (table === 'series') {
    const { error: mappingError } = await supabase
      .from('series_episodes')
      .delete()
      .eq('series_id', id);

    if (mappingError) {
      return {
        success: false,
        message: `매핑 삭제 실패: ${mappingError.message}`,
        stage: 'mapping',
      };
    }
  }

  if (table === 'themes') {
    const { error: mappingError } = await supabase
      .from('themes_programs')
      .delete()
      .eq('theme_id', id);

    if (mappingError) {
      return {
        success: false,
        message: `매핑 삭제 실패: ${mappingError.message}`,
        stage: 'mapping',
      };
    }
  }

  const { error } = await supabase.from(table).delete().eq('id', id);

  if (error) {
    const isRlsError =
      error.message.toLowerCase().includes('row-level security') ||
      error.message.toLowerCase().includes('rls');

    return {
      success: false,
      message: error.message,
      isRlsError,
      stage: 'delete',
    };
  }

  return { success: true };
}
