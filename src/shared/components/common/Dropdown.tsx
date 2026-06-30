import React from 'react';

interface DropdownProps {
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  className?: string;
}

const Dropdown: React.FC<DropdownProps> = ({
  value,
  options,
  onChange,
  className = '',
}) => {
  return (
    <div
      className={`relative inline-block ${className}`}
      style={{ minWidth: 120 }}
    >
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={
          'w-full appearance-none border border-gray-300 px-4 py-2 pr-10 rounded-lg bg-white text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition cursor-pointer'
        }
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <span className='pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400'>
        <svg
          width='18'
          height='18'
          viewBox='0 0 20 20'
          fill='none'
          xmlns='http://www.w3.org/2000/svg'
        >
          <path
            d='M6 8L10 12L14 8'
            stroke='currentColor'
            strokeWidth='2'
            strokeLinecap='round'
            strokeLinejoin='round'
          />
        </svg>
      </span>
    </div>
  );
};

export default Dropdown;
