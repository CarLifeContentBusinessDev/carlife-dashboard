const parseLanguages = (language: unknown): string[] => {
  if (!language) return [];

  if (Array.isArray(language)) return language as string[];

  if (typeof language === 'string') {
    try {
      const parsed: unknown = JSON.parse(language);
      if (Array.isArray(parsed)) return parsed as string[];
    } catch {
      // JSON이 아니면 아래에서 postgres array 문자열로 처리
    }

    if (language.startsWith('{') && language.endsWith('}')) {
      return language.slice(1, -1).split(',');
    }

    return [language];
  }

  return [];
};

export default parseLanguages;
