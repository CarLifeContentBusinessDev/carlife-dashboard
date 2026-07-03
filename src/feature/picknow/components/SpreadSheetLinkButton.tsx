import type { PicknowServer } from '@/constants/servers';
import Button from '@/shared/components/common/Button';

interface SpreadSheetLinkButtonProps {
  selectedServers: PicknowServer[];
  isServerLoggedIn: (serverId: string) => boolean;
  sheetDropdownRef: React.RefObject<HTMLDivElement | null>;
  sheetDropdownOpen: boolean;
  setSheetDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export default function SpreadSheetLinkButton({
  selectedServers,
  isServerLoggedIn,
  sheetDropdownRef,
  sheetDropdownOpen,
  setSheetDropdownOpen,
}: SpreadSheetLinkButtonProps) {
  const loggedInServers = selectedServers.filter((s) => isServerLoggedIn(s.id));
  if (loggedInServers.length === 0) return null;
  if (loggedInServers.length === 1) {
    const s = loggedInServers[0];
    return (
      <Button
        onClick={() => {
          window.open(
            `https://docs.google.com/spreadsheets/d/${s.spreadsheetId}/edit`,
            '_blank'
          );
        }}
      >
        스프레드 시트 바로가기
      </Button>
    );
  }
  return (
    <div className='relative' ref={sheetDropdownRef}>
      <Button onClick={() => setSheetDropdownOpen((v) => !v)}>
        <span className='flex items-center gap-1.5'>
          스프레드 시트 바로가기
          <svg
            className={`w-3.5 h-3.5 transition-transform ${sheetDropdownOpen ? 'rotate-180' : ''}`}
            fill='none'
            viewBox='0 0 24 24'
            stroke='currentColor'
            strokeWidth={2.5}
          >
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              d='M19 9l-7 7-7-7'
            />
          </svg>
        </span>
      </Button>
      {sheetDropdownOpen && (
        <div className='absolute right-0 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg z-10 overflow-hidden'>
          {loggedInServers.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                window.open(
                  `https://docs.google.com/spreadsheets/d/${s.spreadsheetId}/edit`,
                  '_blank'
                );
                setSheetDropdownOpen(false);
              }}
              className='w-full px-4 py-2.5 text-sm text-left text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer'
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
