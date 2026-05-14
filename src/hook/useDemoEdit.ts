import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

interface UseDemoEditOptions {
  table: string;
  numericFields?: string[];
}

interface UseDemoEditReturn<T extends { id: number }> {
  data: T | null;
  setData: React.Dispatch<React.SetStateAction<T | null>>;
  loading: boolean;
  saving: boolean;
  setSaving: React.Dispatch<React.SetStateAction<boolean>>;
  error: string;
  setError: React.Dispatch<React.SetStateAction<string>>;
  handleChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => void;
  handleLangToggle: (lang: string) => void;
  handleLangChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  save: (payload: Record<string, unknown>) => Promise<boolean>;
  navigate: ReturnType<typeof useNavigate>;
}

function useDemoEdit<T extends { id: number }>({
  table,
  numericFields = [],
}: UseDemoEditOptions): UseDemoEditReturn<T> {
  const { id } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    supabase
      .from(table)
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data: row, error: fetchError }) => {
        if (fetchError || !row) {
          setError(`${table} 정보를 불러올 수 없습니다.`);
        } else {
          setData(row as T);
        }
        setLoading(false);
      });
  }, [id, table]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setData((prev) =>
      prev
        ? ({
            ...prev,
            [name]: numericFields.includes(name)
              ? value === ''
                ? null
                : Number(value)
              : value,
          } as T)
        : prev
    );
  };

  const handleLangToggle = (lang: string) => {
    setData((prev) => {
      if (!prev) return prev;
      const prevLanguage = (prev as unknown as { language: unknown }).language;
      if (!Array.isArray(prevLanguage)) return prev;
      const language = prevLanguage as string[];
      return {
        ...prev,
        language: language.includes(lang)
          ? language.filter((l) => l !== lang)
          : [...language, lang],
      } as T;
    });
  };

  const handleLangChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const langs = e.target.value.split(',').map((l) => l.trim());
    setData((prev) => (prev ? ({ ...prev, language: langs } as T) : prev));
  };

  const save = async (
    payload: Record<string, unknown>,
    options: { keepLoading?: boolean } = {}
  ): Promise<boolean> => {
    if (!data) return false;
    setSaving(true);
    setError('');
    const { error: saveError } = await supabase
      .from(table)
      .update(payload)
      .eq('id', data.id);

    if (saveError) {
      console.error('Supabase update error:', saveError);
      setError(`저장에 실패했습니다: ${saveError.message}`);
      setSaving(false);
      return false;
    }

    if (!options.keepLoading) {
      setSaving(false);
    }
    return true;
  };

  return {
    data,
    setData,
    loading,
    saving,
    setSaving,
    error,
    setError,
    handleChange,
    handleLangToggle,
    handleLangChange,
    save,
    navigate,
  };
}

export default useDemoEdit;
