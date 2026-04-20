type UsageFilter = 'All' | 'Y' | 'N';

interface UsageFilterRadioProps {
  name: string;
  value: UsageFilter;
  onChange: (value: UsageFilter) => void;
}

const UsageFilterRadio = ({ name, value, onChange }: UsageFilterRadioProps) => (
  <div className='flex items-center gap-3'>
    <span className='text-sm text-gray-600 font-medium'>활성화:</span>
    {(['All', 'Y', 'N'] as const).map((option) => (
      <label key={option} className='flex items-center gap-1.5 cursor-pointer'>
        <input
          type='radio'
          name={name}
          value={option}
          checked={value === option}
          onChange={() => onChange(option)}
          className='accent-point-color w-4 h-4 cursor-pointer'
        />
        <span className='text-sm text-gray-700'>{option}</span>
      </label>
    ))}
  </div>
);

export default UsageFilterRadio;
