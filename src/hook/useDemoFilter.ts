import type { StatusFilter } from '@/components/demo/DemoListLayout';
import type { LanguageCode } from '@/constants/languages';
import parseLanguages from '@/utils/format/parseLanguages';
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
  options: { hasStatusFilter?: boolean; hasSearchableFilter?: boolean } = {}
) {
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
      if (!options.hasStatusFilter || statusFilter === 'all') return true;
      return statusFilter === 'active'
        ? item.is_active === true
        : item.is_active === false;
    })
    .filter((item) => {
      if (!options.hasSearchableFilter || searchableFilter === 'all')
        return true;
      return searchableFilter === 'active'
        ? item.is_searchable === true
        : item.is_searchable === false;
    })
    .filter((item) => {
      if (!searchQuery) return true;
      return item.title?.toLowerCase().includes(searchQuery.toLowerCase());
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
