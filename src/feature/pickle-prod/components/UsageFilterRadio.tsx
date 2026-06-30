type UsageFilter = 'All' | 'Y' | 'N';

interface UsageFilterRadioProps<T extends string = UsageFilter> {
  name: string;
  value: T;
  onChange: (value: T) => void;
  label?: string;
  options?: readonly T[];
}

const DEFAULT_OPTIONS = ['All', 'Y', 'N'] as const;

const UsageFilterRadio = <T extends string = UsageFilter>({
  name,
  value,
  onChange,
  label = '활성 상태',
  options = DEFAULT_OPTIONS as unknown as readonly T[],
}: UsageFilterRadioProps<T>) => (
  <div className='flex items-center gap-3'>
    <span className='text-sm text-gray-600 font-medium'>{label}:</span>
    {options.map((option) => (
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
