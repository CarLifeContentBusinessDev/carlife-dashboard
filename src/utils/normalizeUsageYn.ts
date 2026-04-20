const TRUE_VALUES = ['Y', 'YES', 'TRUE', '1', 'ACTIVE'];
const FALSE_VALUES = ['N', 'NO', 'FALSE', '0', 'INACTIVE'];

export const normalizeUsageYn = (value: unknown): 'Y' | 'N' | '' => {
  const normalized = String(value ?? '')
    .trim()
    .toUpperCase();

  if (TRUE_VALUES.includes(normalized)) return 'Y';
  if (FALSE_VALUES.includes(normalized)) return 'N';

  return '';
};
