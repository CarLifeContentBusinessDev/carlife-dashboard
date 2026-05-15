import React from 'react';
import Dropdown from '@/components/common/Dropdown';

interface SheetSelectProps {
  value: string;
  options: { id: string; name: string }[];
  onChange: (value: string) => void;
  className?: string;
}

const SheetSelect: React.FC<SheetSelectProps> = ({
  value,
  options,
  onChange,
  className = '',
}) => {
  const dropdownOptions = [
    { value: '', label: '시트 선택' },
    ...options.map((sheet) => ({ value: sheet.name, label: sheet.name })),
  ];
  return (
    <Dropdown
      value={value}
      options={dropdownOptions}
      onChange={onChange}
      className={className}
    />
  );
};

export default SheetSelect;
