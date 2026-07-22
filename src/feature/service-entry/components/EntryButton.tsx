type EntryButtonProps = {
  handleSelect: () => void;
  logo: string;
  title: string;
  description: string;
};

export const EntryButton = ({
  handleSelect,
  logo,
  title,
  description,
}: EntryButtonProps) => {
  return (
    <button
      onClick={handleSelect}
      className='w-64 h-52 rounded-2xl bg-[#1B1E2F] text-white flex flex-col items-center justify-center gap-3 shadow-xl hover:scale-105 transition-transform cursor-pointer'
    >
      <img src={logo} alt={title} width={48} height={48} />
      <span className='text-2xl font-bold'>{title}</span>
      <span className='text-sm text-gray-400'>{description}</span>
    </button>
  );
};
