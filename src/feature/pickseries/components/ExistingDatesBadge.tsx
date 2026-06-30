interface ExistingDatesBadgeProps {
  existingDates: string[];
  selectedDateCount: number;
}

const ExistingDatesBadge = ({
  existingDates,
  selectedDateCount,
}: ExistingDatesBadgeProps) => {
  const existCount = existingDates.length;
  if (existCount === 0) return null;

  const className =
    'text-xs px-1.5 py-0.5 rounded bg-rose-100 text-rose-500 font-medium shrink-0';

  if (existCount === selectedDateCount) {
    return <span className={className}>존재</span>;
  }

  const dateStr =
    existingDates.length <= 2
      ? existingDates.map((d) => d.split('.').slice(1).join('.')).join(', ')
      : `${existingDates[0].split('.').slice(1).join('.')} 외 ${existingDates.length - 1}건`;

  return (
    <span className={className}>
      {dateStr} 존재
    </span>
  );
};

export default ExistingDatesBadge;
