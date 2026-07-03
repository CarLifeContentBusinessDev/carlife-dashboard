interface OemCheckboxProps {
  state: 'none' | 'partial' | 'all';
}

export default function OemCheckbox({ state }: OemCheckboxProps) {
  const base =
    'w-[18px] h-[18px] shrink-0 rounded-[5px] flex items-center justify-center border-2 transition-colors';

  if (state === 'none') {
    return <div className={`${base} border-gray-300 bg-white`} />;
  }
  if (state === 'partial') {
    return (
      <div className={`${base} border-indigo-600 bg-indigo-600`}>
        <div className='w-2 h-0.5 bg-white rounded-sm' />
      </div>
    );
  }
  return (
    <div className={`${base} border-white bg-white`}>
      <svg
        className='w-3 h-3 text-indigo-600'
        fill='none'
        viewBox='0 0 24 24'
        stroke='currentColor'
        strokeWidth={3}
      >
        <path strokeLinecap='round' strokeLinejoin='round' d='M5 13l4 4L19 7' />
      </svg>
    </div>
  );
}
