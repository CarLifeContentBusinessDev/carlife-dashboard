import { useEffect, useMemo, useState } from 'react';
import { useLoginTokenStore } from '../../store/useLoginTokenStore';
import { fetchSettingData } from '../../utils/googleSheets/fetchSettingData';
import type { SettingRow } from '../../utils/googleSheets/fetchSettingData';

export default function ExcelSyncPage() {
  const { loginToken } = useLoginTokenStore();
  const [rows, setRows] = useState<SettingRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set());
  // OEM key: `${client}::${oem}` — 고객사가 다르면 같은 OEM명도 구분
  const [selectedOEMs, setSelectedOEMs] = useState<Set<string>>(new Set());
  // DEVICE key: `${client}::${oem}::${device}`
  const [selectedDevices, setSelectedDevices] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!loginToken) return;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchSettingData();
        setRows(data);
      } catch (err) {
        setError('데이터를 불러오는 데 실패했습니다. Google Sheets 로그인 상태를 확인해주세요.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [loginToken]);

  // { [고객사]: { [OEM]: DEVICE[] } }
  const grouped = useMemo(() => {
    const map: Record<string, Record<string, string[]>> = {};
    rows.forEach((row) => {
      if (!map[row.고객사]) map[row.고객사] = {};
      if (!map[row.고객사][row.OEM]) map[row.고객사][row.OEM] = [];
      if (!map[row.고객사][row.OEM].includes(row.DEVICE)) {
        map[row.고객사][row.OEM].push(row.DEVICE);
      }
    });
    return map;
  }, [rows]);

  const toggleClient = (client: string) => {
    setSelectedClients((prev) => {
      const next = new Set(prev);
      if (next.has(client)) {
        next.delete(client);
        // 하위 OEM, DEVICE 선택 해제
        setSelectedOEMs((o) => {
          const on = new Set(o);
          [...on].filter((k) => k.startsWith(`${client}::`)).forEach((k) => on.delete(k));
          return on;
        });
        setSelectedDevices((d) => {
          const dn = new Set(d);
          [...dn].filter((k) => k.startsWith(`${client}::`)).forEach((k) => dn.delete(k));
          return dn;
        });
      } else {
        next.add(client);
      }
      return next;
    });
  };

  const toggleOEM = (client: string, oem: string) => {
    const key = `${client}::${oem}`;
    setSelectedOEMs((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
        setSelectedDevices((d) => {
          const dn = new Set(d);
          [...dn].filter((k) => k.startsWith(`${key}::`)).forEach((k) => dn.delete(k));
          return dn;
        });
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const toggleDevice = (client: string, oem: string, device: string) => {
    const key = `${client}::${oem}::${device}`;
    setSelectedDevices((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className='p-8 max-w-5xl'>
      <h1 className='text-2xl font-bold text-[#1B1E2F] mb-6'>콘텐츠 데이터 추출</h1>

      {!loginToken ? (
        <p className='text-gray-400 text-sm'>헤더에서 Google Sheets 로그인 후 이용해주세요.</p>
      ) : loading ? (
        <p className='text-sm text-gray-400'>데이터를 불러오는 중...</p>
      ) : error ? (
        <p className='text-sm text-red-500 bg-red-50 px-4 py-2 rounded-md'>{error}</p>
      ) : (
        <div className='flex flex-col gap-1'>
          {Object.keys(grouped).sort().map((client) => (
            <div key={client}>
              {/* 고객사 */}
              <div className='flex items-center gap-2 py-1'>
                <Chip
                  label={client}
                  selected={selectedClients.has(client)}
                  onToggle={() => toggleClient(client)}
                />
              </div>

              {/* OEM (고객사 선택 시) */}
              {selectedClients.has(client) && (
                <div className='ml-6 border-l-2 border-gray-200 pl-4 mb-2'>
                  {Object.keys(grouped[client]).sort().map((oem) => {
                    const oemKey = `${client}::${oem}`;
                    return (
                      <div key={oem} className='mb-1'>
                        <div className='flex items-center gap-2 py-1'>
                          <Chip
                            label={oem}
                            selected={selectedOEMs.has(oemKey)}
                            onToggle={() => toggleOEM(client, oem)}
                          />
                        </div>

                        {/* DEVICE (OEM 선택 시) */}
                        {selectedOEMs.has(oemKey) && (
                          <div className='ml-6 border-l-2 border-gray-100 pl-4 flex flex-wrap gap-1.5 pb-1'>
                            {grouped[client][oem].sort().map((device) => {
                              const deviceKey = `${client}::${oem}::${device}`;
                              return (
                                <Chip
                                  key={device}
                                  label={device}
                                  selected={selectedDevices.has(deviceKey)}
                                  onToggle={() => toggleDevice(client, oem, device)}
                                  size='sm'
                                />
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface ChipProps {
  label: string;
  selected: boolean;
  onToggle: () => void;
  size?: 'md' | 'sm';
}

function Chip({ label, selected, onToggle, size = 'md' }: ChipProps) {
  return (
    <button
      onClick={onToggle}
      className={`rounded-full border font-medium transition-colors
        ${size === 'md' ? 'px-3.5 py-1.5 text-sm' : 'px-2.5 py-1 text-xs'}
        ${selected
          ? 'bg-[#1B1E2F] text-white border-[#1B1E2F]'
          : 'bg-white text-gray-600 border-gray-300 hover:border-[#1B1E2F]'
        }`}
    >
      {label}
    </button>
  );
}
