import { useEffect, useRef, useState } from 'react';

interface ServerBase {
  id: string;
  label: string;
  isActive?: boolean;
}

interface ServerConnectionDropdownProps<T extends ServerBase> {
  servers: T[];
  serverTokens: Record<string, string>;
  clearServerToken: (id: string) => void;
  onRequestLogin: (server: T) => void;
  connectedActionLabel?: string;
  disconnectedActionLabel?: string;
  menuWidthClassName?: string;
}

const ServerConnectionDropdown = <T extends ServerBase>({
  servers,
  serverTokens,
  clearServerToken,
  onRequestLogin,
  connectedActionLabel = '로그아웃',
  disconnectedActionLabel = '로그인',
  menuWidthClassName = 'w-72',
}: ServerConnectionDropdownProps<T>) => {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const connectedCount = servers.filter((s) => !!serverTokens[s.id]).length;

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div className='relative' ref={dropdownRef}>
      <button
        onClick={() => setOpen((prev) => !prev)}
        className='shrink-0 whitespace-nowrap flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-gray-200 text-sm font-medium hover:bg-gray-50 cursor-pointer transition-colors'
      >
        <span
          className={`w-2 h-2 rounded-full shrink-0 ${connectedCount > 0 ? 'bg-green-500' : 'bg-gray-300'}`}
        />
        서버 연결 {connectedCount}/{servers.length}
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill='none'
          viewBox='0 0 24 24'
          stroke='currentColor'
          strokeWidth={2}
        >
          <path
            strokeLinecap='round'
            strokeLinejoin='round'
            d='M19 9l-7 7-7-7'
          />
        </svg>
      </button>

      {open && (
        <div
          className={`absolute right-0 top-full mt-2 ${menuWidthClassName} bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-50`}
        >
          {servers.map((server) => {
            const connected = !!serverTokens[server.id];
            return (
              <div
                key={server.id}
                className={`flex items-center gap-3 px-4 py-3 hover:bg-gray-50 `}
              >
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${connected ? 'bg-green-500' : 'bg-gray-300'}`}
                />
                <span className='flex-1 text-sm font-medium text-gray-700'>
                  {server.label}
                </span>
                <span
                  className={`text-xs ${connected ? 'text-green-600' : 'hidden'}`}
                >
                  {connected ? '연결됨' : server.isActive ? '미연결' : '연동전'}
                </span>
                <button
                  onClick={() => {
                    if (server.isActive === false) {
                      return;
                    }

                    if (connected) {
                      clearServerToken(server.id);
                    } else {
                      setOpen(false);
                      onRequestLogin(server);
                    }
                  }}
                  className={`text-xs px-3 py-1 rounded-full border cursor-pointer transition-colors ${
                    connected
                      ? 'border-red-200 text-red-500 hover:bg-red-50'
                      : server.isActive
                        ? 'border-indigo-200 text-indigo-600 hover:bg-indigo-50'
                        : 'border-gray-200 text-gray-400 hover:bg-gray-50'
                  }`}
                >
                  {connected
                    ? connectedActionLabel
                    : server.isActive
                      ? disconnectedActionLabel
                      : '연동 전'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ServerConnectionDropdown;
