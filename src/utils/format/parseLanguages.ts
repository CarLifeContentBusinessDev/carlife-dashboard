const parseLanguages = (language: any): string[] => {
  if (!language) return [];

  if (Array.isArray(language)) return language;

  if (typeof language === 'string') {
    try {
      const parsed = JSON.parse(language);
      if (Array.isArray(parsed)) return parsed;
    } catch {}

    // postgres array "{ko,en}"
    if (language.startsWith('{') && language.endsWith('}')) {
      return language.slice(1, -1).split(',');
    }

    return [language];
  }

  return [];
};

export default parseLanguages;
