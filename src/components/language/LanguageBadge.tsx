interface Props {
  languages: string[] | string;
}

const LanguageBadge = ({ languages }: Props) => {
  const langs = Array.isArray(languages) ? languages : [languages];

  return (
    <>
      {langs.map((lang) => (
        <span
          key={lang}
          className='bg-gray-200 text-gray-700 rounded px-2 py-0.5 text-xs mr-1'
        >
          {lang}
        </span>
      ))}
    </>
  );
};

export default LanguageBadge;
