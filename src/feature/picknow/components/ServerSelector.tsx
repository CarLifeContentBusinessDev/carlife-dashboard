import { PICKNOW_SERVERS, type PicknowServer } from '@/constants/servers';

interface ServerSelectorProps {
  isServerLoggedIn: (serverId: string) => boolean;
  selectedServerIds: string[];
  toggleSelectedServer: (serverId: string) => void;
  setLoginModalServer: (server: (typeof PICKNOW_SERVERS)[number]) => void;
}

const SERVER_GROUP_LABELS: Record<string, string> = {
  stg: 'STG',
  demo: 'Demo',
  prod: '상용',
};

const getServerGroupKey = (server: PicknowServer): string =>
  server.id.split('-')[1] ?? '';

const SERVER_GROUPS: { key: string; label: string; servers: PicknowServer[] }[] =
  Object.entries(SERVER_GROUP_LABELS).map(([key, label]) => ({
    key,
    label,
    servers: PICKNOW_SERVERS.filter((server) => getServerGroupKey(server) === key),
  }));

export default function ServerSelector({
  isServerLoggedIn,
  selectedServerIds,
  toggleSelectedServer,
  setLoginModalServer,
}: ServerSelectorProps) {
  return (
    <div className='mb-5'>
      <span className='text-sm font-medium text-gray-500'>서버 선택</span>
      <div className='mt-2 flex flex-col gap-2'>
        {SERVER_GROUPS.map((group) => (
          <div key={group.key} className='flex items-center gap-3'>
            <span className='text-xs font-medium text-gray-400 w-10 shrink-0'>
              {group.label}
            </span>
            <div className='flex gap-2 flex-wrap'>
              {group.servers.map((server) => {
                const connected = isServerLoggedIn(server.id);
                const isSelected = selectedServerIds.includes(server.id);
                return (
                  <button
                    key={server.id}
                    onClick={() => {
                      if (!connected) {
                        setLoginModalServer(server);
                      } else {
                        toggleSelectedServer(server.id);
                      }
                    }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors cursor-pointer ${
                      isSelected && connected
                        ? 'bg-indigo-600 border-indigo-600 text-white'
                        : connected
                          ? 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                          : 'bg-gray-50 border-dashed border-gray-300 text-gray-400'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${connected ? (isSelected ? 'bg-white' : 'bg-green-500') : 'bg-gray-300'}`}
                    />
                    {server.label}
                    {!connected && (
                      <span className='text-xs text-gray-400'>(미연결)</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
