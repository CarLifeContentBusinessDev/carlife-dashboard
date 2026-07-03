interface DeviceChipProps {
  label: string;
  selected: boolean;
  onToggle: () => void;
}

export default function DeviceChip({
  label,
  selected,
  onToggle,
}: DeviceChipProps) {
  return (
    <button
      onClick={onToggle}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all border cursor-pointer
        ${
          selected
            ? 'bg-indigo-600 border-indigo-600 text-white hover:bg-indigo-700 hover:border-indigo-700'
            : 'bg-white border-gray-200 text-gray-700 hover:border-indigo-500 hover:text-indigo-700 hover:bg-indigo-50'
        }`}
    >
      {selected && (
        <span className='w-3.5 h-3.5 inline-flex items-center justify-center rounded-full bg-white/25 shrink-0'>
          <svg
            className='w-2.5 h-2.5 text-white'
            fill='none'
            viewBox='0 0 24 24'
            stroke='currentColor'
            strokeWidth={3}
          >
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              d='M5 13l4 4L19 7'
            />
          </svg>
        </span>
      )}
      {label}
    </button>
  );
}
