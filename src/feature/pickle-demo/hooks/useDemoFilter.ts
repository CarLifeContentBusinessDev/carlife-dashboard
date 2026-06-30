import type { StatusFilter } from '@/feature/pickle-demo/components/DemoListLayout';
import type { LanguageCode } from '@/constants/languages';
import parseLanguages from '@/shared/utils/format/parseLanguages';
import { useState } from 'react';

export default function useDemoFilter<
  T extends {
    language: string[] | string;
    title?: string;
    is_active?: boolean;
    is_searchable?: boolean;
  },
>(
  data: T[],
  options: {
    hasStatusFilter?: boolean;
    hasSearchableFilter?: boolean;
    searchFields?: (keyof T)[];
  } = {}
) {
  const {
    hasStatusFilter = false,
    hasSearchableFilter = false,
    searchFields = ['title' as keyof T],
  } = options;
  const [selectedLang, setSelectedLang] = useState<LanguageCode>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchableFilter, setSearchableFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredData = data
    .filter((item) => {
      if (selectedLang === 'all') return true;
      const langs = parseLanguages(item.language);
      return langs.includes(selectedLang);
    })
    .filter((item) => {
      if (!hasStatusFilter || statusFilter === 'all') return true;
      return statusFilter === 'active'
        ? item.is_active === true
        : item.is_active === false;
    })
    .filter((item) => {
      if (!hasSearchableFilter || searchableFilter === 'all') return true;
      return searchableFilter === 'active'
        ? item.is_searchable === true
        : item.is_searchable === false;
    })
    .filter((item) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return searchFields.some((field) =>
        String(item[field] ?? '')
          .toLowerCase()
          .includes(q)
      );
    });

  return {
    selectedLang,
    setSelectedLang,
    statusFilter,
    setStatusFilter,
    searchableFilter,
    setSearchableFilter,
    searchQuery,
    setSearchQuery,
    filteredData,
  };
}
