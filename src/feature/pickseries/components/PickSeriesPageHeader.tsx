import Button from '@/shared/components/common/Button';

interface PickSeriesPageHeaderProps {
  title: string;
  description: string;
}

export default function PickSeriesPageHeader({
  title,
  description,
}: PickSeriesPageHeaderProps) {
  return (
    <div className='flex justify-between mb-5'>
      <div className='flex items-end gap-3'>
        <h1 className='text-xl font-black text-[#1B1E2F]'>{title}</h1>
        <span className='text-sm text-slate-400 pb-0.5'>{description}</span>
      </div>
      <Button
        onClick={() => {
          window.open(
            `https://docs.google.com/spreadsheets/d/${import.meta.env.VITE_PICKSERIES_SPREADSHEET_ID}/edit`,
            '_blank'
          );
        }}
      >
        스프레드 시트 바로가기
      </Button>
    </div>
  );
}
