import React from 'react';

interface LanguageSelectProps {
  value: 'ko' | 'en' | 'de' | 'jp';
  onChange: (lang: 'ko' | 'en' | 'de' | 'jp') => void;
  className?: string;
}

const LanguageSelect: React.FC<LanguageSelectProps> = ({ value, onChange, className = '' }) => {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value as 'ko' | 'en' | 'de' | 'jp')}
      className={`w-fit appearance-none border border-gray-300 px-4 py-2 pr-10 rounded-lg bg-white text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition cursor-pointer ${className}`}
    >
      <option value='ko'>한국(ko)</option>
      <option value='en'>영어(en)</option>
      <option value='de'>독일어(de)</option>
      <option value='jp'>일본어(jp)</option>
    </select>
  );
};

export default LanguageSelect;
