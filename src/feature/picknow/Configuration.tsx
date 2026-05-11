import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { useLoginTokenStore } from '../../store/useLoginTokenStore';
import type { SettingRow } from '../../utils/googleSheets/fetchSettingData';
import { fetchSettingData } from '../../utils/googleSheets/fetchSettingData';
import { syncPicknowConfigurationSheet } from '../../utils/googleSheets/syncPicknowConfigurationSheet';
import Button from '../../components/common/Button';

export default function Configuration() {
  const { loginToken } = useLoginTokenStore();
  const [rows, setRows] = useState<SettingRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [selectedDevices, setSelectedDevices] = useState<Set<string>>(
    new Set()
  );
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!loginToken) return;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchSettingData();
        setRows(data);
      } catch (err) {
        setError(
          '데이터를 불러오는 데 실패했습니다. Google Sheets 로그인 상태를 확인해주세요.'
        );
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [loginToken]);

  const handleExtractData = async () => {
    if (selectedClients.length === 0) {
      toast.error('데이터 추출할 고객사를 먼저 선택해주세요.');
      return;
    }

    setExportLoading(true);
    const results: { success: string[]; failed: string[] } = {
      success: [],
      failed: [],
    };

    try {
      for (const customerName of selectedClients) {
        const selections = [...selectedDevices]
          .map((key) => {
            const [client, oem, device] = key.split('::');
            return { client, oem, device };
          })
          .filter((item) => item.client === customerName);

        if (selections.length === 0) {
          results.failed.push(customerName);
          continue;
        }

        try {
          const syncResult = await syncPicknowConfigurationSheet(
            customerName,
            selections
          );
          results.success.push(customerName);
          if (syncResult.failedBookmarkSeqs.length > 0) {
            console.warn(
              `${customerName} 일부 bookmark 상세 조회 실패:`,
              syncResult.failedBookmarkSeqs
            );
          }
        } catch (err) {
          console.error(`${customerName} 시트 생성 실패:`, err);
          results.failed.push(customerName);
        }
      }

      if (results.success.length > 0 && results.failed.length === 0) {
        toast.success(
          `${results.success.length}개 고객사 시트에 데이터를 동기화했습니다.`
        );
      } else if (results.success.length > 0 && results.failed.length > 0) {
        toast.warning(
          `${results.success.length}개 성공, ${results.failed.length}개 실패 (${results.failed.join(', ')})`
        );
      } else {
        toast.error('모든 데이터 동기화에 실패했습니다.');
      }
    } catch (err) {
      console.error(err);
      toast.error('데이터 추출 중 오류가 발생했습니다.');
    } finally {
      setExportLoading(false);
    }
  };

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

  const filteredGrouped = useMemo(() => {
    if (!search.trim()) return grouped;
    const q = search.toLowerCase();
    const result: Record<string, Record<string, string[]>> = {};
    Object.entries(grouped).forEach(([client, oems]) => {
      const clientMatch = client.toLowerCase().includes(q);
      Object.entries(oems).forEach(([oem, devices]) => {
        const oemMatch = oem.toLowerCase().includes(q);
        const matched =
          clientMatch || oemMatch
            ? devices
            : devices.filter((d) => d.toLowerCase().includes(q));
        if (matched.length > 0) {
          if (!result[client]) result[client] = {};
          result[client][oem] = matched;
        }
      });
    });
    return result;
  }, [grouped, search]);

  const allDeviceKeys = useMemo(() => {
    const keys: string[] = [];
    Object.entries(grouped).forEach(([client, oems]) => {
      Object.entries(oems).forEach(([oem, devices]) => {
        devices.forEach((d) => keys.push(`${client}::${oem}::${d}`));
      });
    });
    return keys;
  }, [grouped]);

  const getOemState = (
    client: string,
    oem: string
  ): 'none' | 'partial' | 'all' => {
    const devices = grouped[client]?.[oem] ?? [];
    if (devices.length === 0) return 'none';
    const count = devices.filter((d) =>
      selectedDevices.has(`${client}::${oem}::${d}`)
    ).length;
    if (count === 0) return 'none';
    if (count === devices.length) return 'all';
    return 'partial';
  };

  const getClientCounts = (client: string) => {
    const oems = Object.keys(grouped[client] ?? {});
    const total = oems.reduce((s, oem) => s + grouped[client][oem].length, 0);
    const selected = oems.reduce(
      (s, oem) =>
        s +
        grouped[client][oem].filter((d) =>
          selectedDevices.has(`${client}::${oem}::${d}`)
        ).length,
      0
    );
    return { total, selected, oemCount: oems.length };
  };

  const toggleOEM = (client: string, oem: string) => {
    const devices = grouped[client]?.[oem] ?? [];
    const state = getOemState(client, oem);
    setSelectedDevices((prev) => {
      const next = new Set(prev);
      if (state === 'all') {
        devices.forEach((d) => next.delete(`${client}::${oem}::${d}`));
      } else {
        devices.forEach((d) => next.add(`${client}::${oem}::${d}`));
      }
      return next;
    });
  };

  const toggleClient = (client: string) => {
    const { total, selected } = getClientCounts(client);
    const oems = Object.keys(grouped[client] ?? {});
    setSelectedDevices((prev) => {
      const next = new Set(prev);
      if (selected === total && total > 0) {
        oems.forEach((oem) =>
          grouped[client][oem].forEach((d) =>
            next.delete(`${client}::${oem}::${d}`)
          )
        );
      } else {
        oems.forEach((oem) =>
          grouped[client][oem].forEach((d) =>
            next.add(`${client}::${oem}::${d}`)
          )
        );
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

  const toggleCollapse = (client: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(client)) next.delete(client);
      else next.add(client);
      return next;
    });
  };

  const selectedOEMCount = useMemo(() => {
    const oemSet = new Set<string>();
    [...selectedDevices].forEach((key) => {
      const parts = key.split('::');
      oemSet.add(`${parts[0]}::${parts[1]}`);
    });
    return oemSet.size;
  }, [selectedDevices]);

  const selectedClients = useMemo(() => {
    return [...new Set([...selectedDevices].map((key) => key.split('::')[0]))]
      .filter(Boolean)
      .sort();
  }, [selectedDevices]);

  // 하단 요약: OEM/DEVICE 형식
  const summaryItems = useMemo(() => {
    return [...selectedDevices]
      .map((key) => {
        const parts = key.split('::');
        return `${parts[1]}/${parts[2]}`;
      })
      .sort();
  }, [selectedDevices]);

  return (
    <div className='p-6'>
      <div className='flex justify-between mb-5'>
        <div className='flex items-end gap-3'>
          <h1 className='text-2xl font-bold text-[#1B1E2F]'>
            Configuration 데이터 추출
          </h1>
          <span className='text-sm text-slate-400 pb-0.5'>
            OEM과 디바이스를 선택해 데이터를 추출하세요
          </span>
        </div>
        <Button onClick={() => {}}>시트 바로가기</Button>
      </div>

      {!loginToken ? (
        <div className='rounded-xl border border-dashed border-gray-300 bg-white px-4 py-5 flex flex-col gap-3'>
          <p className='text-gray-600 text-sm'>
            Google Sheets 로그인이 필요합니다.
          </p>
        </div>
      ) : loading ? (
        <p className='text-sm text-gray-400'>데이터를 불러오는 중...</p>
      ) : error ? (
        <p className='text-sm text-red-500 bg-red-50 px-4 py-2 rounded-md'>
          {error}
        </p>
      ) : (
        <div className='flex flex-col gap-5'>
          {/* 액션 바 */}
          <div className='flex gap-2 items-center bg-white border border-gray-200 rounded-xl px-3 py-2.5 flex-wrap'>
            <div className='flex-1 min-w-48 flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5'>
              <svg
                className='w-4 h-4 text-gray-400 shrink-0'
                fill='none'
                viewBox='0 0 24 24'
                stroke='currentColor'
                strokeWidth={2}
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  d='M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z'
                />
              </svg>
              <input
                type='text'
                placeholder='OEM 또는 디바이스 검색'
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className='flex-1 bg-transparent text-sm text-gray-700 outline-none placeholder:text-gray-400'
              />
            </div>

            <div className='w-px self-stretch bg-gray-200' />

            <button
              onClick={() => setSelectedDevices(new Set(allDeviceKeys))}
              className='flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-semibold text-slate-700 border border-gray-200 bg-white hover:bg-gray-50 transition-colors cursor-pointer'
            >
              <svg
                className='w-4 h-4'
                fill='none'
                viewBox='0 0 24 24'
                stroke='currentColor'
                strokeWidth={2}
              >
                <rect x='3' y='3' width='18' height='18' rx='3' />
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  d='M7 12l3 3 7-7'
                />
              </svg>
              모두 선택
            </button>

            <button
              onClick={() => setSelectedDevices(new Set())}
              className='flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-semibold text-orange-500 border border-gray-200 bg-white hover:bg-orange-50 transition-colors cursor-pointer'
            >
              <svg
                className='w-4 h-4'
                fill='none'
                viewBox='0 0 24 24'
                stroke='currentColor'
                strokeWidth={2}
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  d='M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15'
                />
              </svg>
              초기화
            </button>

            {selectedDevices.size > 0 && (
              <div className='flex items-center gap-1.5 bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-full font-bold text-sm'>
                <div className='w-1.5 h-1.5 rounded-full bg-indigo-600' />
                {selectedOEMCount} OEM · {selectedDevices.size} Device
              </div>
            )}
          </div>

          {/* 고객사 섹션 */}
          {Object.keys(filteredGrouped)
            .sort()
            .map((client) => {
              const isCollapsed = collapsed.has(client);
              const { total, selected, oemCount } = getClientCounts(client);
              const clientAllSelected = selected === total && total > 0;
              const clientPartialSelected = selected > 0 && selected < total;
              const filteredOems = Object.keys(filteredGrouped[client]).sort();

              return (
                <div key={client}>
                  {/* 고객사 헤더 */}
                  <div className='flex items-center gap-3 pb-3'>
                    <div
                      className='flex items-center gap-3 flex-1 min-w-0 cursor-pointer select-none'
                      onClick={() => toggleCollapse(client)}
                    >
                      <svg
                        className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${isCollapsed ? '-rotate-90' : ''}`}
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
                      <span className='text-base font-bold text-[#1B1E2F] truncate'>
                        {client}
                      </span>
                      <span className='text-xs text-gray-400 shrink-0'>
                        OEM {oemCount} · Device {total}
                        {selected > 0 && (
                          <span className='text-indigo-600 font-semibold'>
                            {' '}
                            · {selected} 선택됨
                          </span>
                        )}
                      </span>
                    </div>

                    {/* 고객사 전체 선택 */}
                    <button
                      onClick={() => toggleClient(client)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors shrink-0 cursor-pointer
                        ${
                          clientAllSelected
                            ? 'bg-indigo-600 border-indigo-600 text-white hover:bg-indigo-700'
                            : clientPartialSelected
                              ? 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100'
                              : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                    >
                      <OemCheckbox
                        state={
                          clientAllSelected
                            ? 'all'
                            : clientPartialSelected
                              ? 'partial'
                              : 'none'
                        }
                      />
                      고객사 전체
                    </button>
                  </div>

                  {/* 레인 그리드 */}
                  {!isCollapsed && (
                    <div className='bg-white border border-gray-200 rounded-xl overflow-hidden'>
                      {filteredOems.map((oem, i) => {
                        const oemState = getOemState(client, oem);
                        const devices = filteredGrouped[client][oem].sort();
                        return (
                          <div
                            key={oem}
                            className={`grid min-h-16 ${i > 0 ? 'border-t border-gray-100' : ''}`}
                            style={{ gridTemplateColumns: '240px 1fr' }}
                          >
                            {/* OEM 셀 */}
                            <div
                              className={`flex items-center gap-2.5 px-4 py-3.5 border-r border-gray-100 cursor-pointer transition-colors
                                ${
                                  oemState === 'all'
                                    ? 'bg-indigo-600 hover:bg-indigo-700'
                                    : oemState === 'partial'
                                      ? 'bg-indigo-50 hover:bg-indigo-100'
                                      : 'bg-gray-50 hover:bg-gray-100'
                                }`}
                              onClick={() => toggleOEM(client, oem)}
                            >
                              <OemCheckbox state={oemState} />
                              <div className='flex-1 min-w-0'>
                                <div
                                  className={`text-sm font-bold truncate ${oemState === 'all' ? 'text-white' : 'text-[#1B1E2F]'}`}
                                >
                                  {oem}
                                </div>
                                <div
                                  className={`text-xs mt-0.5 ${
                                    oemState === 'all'
                                      ? 'text-white/75'
                                      : oemState === 'partial'
                                        ? 'text-indigo-700'
                                        : 'text-gray-400'
                                  }`}
                                >
                                  {devices.length}개 기기
                                </div>
                              </div>
                            </div>

                            {/* 기기 셀 */}
                            <div className='flex flex-wrap gap-2 p-3.5 items-center'>
                              {devices.length === 0 ? (
                                <span className='text-gray-400 text-sm italic'>
                                  등록된 디바이스가 없습니다
                                </span>
                              ) : (
                                devices.map((device) => {
                                  const deviceKey = `${client}::${oem}::${device}`;
                                  return (
                                    <DeviceChip
                                      key={device}
                                      label={device}
                                      selected={selectedDevices.has(deviceKey)}
                                      onToggle={() =>
                                        toggleDevice(client, oem, device)
                                      }
                                    />
                                  );
                                })
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

          {/* 하단 선택 요약 바 */}
          {selectedDevices.size > 0 && (
            <div className='sticky bottom-4 bg-white border border-gray-200 rounded-xl px-4 py-3.5 flex items-center gap-3 shadow-[0_-8px_24px_rgba(15,23,42,0.06)]'>
              <div className='flex items-center gap-1.5 bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-full font-bold text-sm shrink-0'>
                <div className='w-1.5 h-1.5 rounded-full bg-indigo-600' />
                {selectedDevices.size} 개 선택됨
              </div>

              <div className='flex-1 min-w-0 flex gap-1.5 flex-wrap'>
                {summaryItems.map((item) => (
                  <span
                    key={item}
                    className='text-[11px] px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 border border-gray-200 font-medium whitespace-nowrap'
                  >
                    {item}
                  </span>
                ))}
              </div>

              <button
                type='button'
                onClick={handleExtractData}
                disabled={exportLoading}
                className='flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg transition-colors shrink-0 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60'
              >
                <svg
                  className='w-4 h-4'
                  fill='none'
                  viewBox='0 0 24 24'
                  stroke='currentColor'
                  strokeWidth={2.5}
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    d='M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4'
                  />
                </svg>
                {exportLoading ? '생성 중...' : '데이터 추출'}
                <svg
                  className='w-3.5 h-3.5'
                  fill='none'
                  viewBox='0 0 24 24'
                  stroke='currentColor'
                  strokeWidth={2.5}
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    d='M9 5l7 7-7 7'
                  />
                </svg>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface OemCheckboxProps {
  state: 'none' | 'partial' | 'all';
}

function OemCheckbox({ state }: OemCheckboxProps) {
  const base =
    'w-[18px] h-[18px] flex-shrink-0 rounded-[5px] flex items-center justify-center border-2 transition-colors';

  if (state === 'none') {
    return <div className={`${base} border-gray-300 bg-white`} />;
  }
  if (state === 'partial') {
    return (
      <div className={`${base} border-indigo-600 bg-indigo-600`}>
        <div className='w-2 h-0.5 bg-white rounded-sm' />
      </div>
    );
  }
  return (
    <div className={`${base} border-white bg-white`}>
      <svg
        className='w-3 h-3 text-indigo-600'
        fill='none'
        viewBox='0 0 24 24'
        stroke='currentColor'
        strokeWidth={3}
      >
        <path strokeLinecap='round' strokeLinejoin='round' d='M5 13l4 4L19 7' />
      </svg>
    </div>
  );
}

interface DeviceChipProps {
  label: string;
  selected: boolean;
  onToggle: () => void;
}

function DeviceChip({ label, selected, onToggle }: DeviceChipProps) {
  return (
    <button
      onClick={onToggle}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all border cursor-pointer
        ${
          selected
            ? 'bg-indigo-600 border-indigo-600 text-white hover:bg-indigo-700 hover:border-indigo-700'
            : 'bg-white border-gray-200 text-gray-700 hover:border-indigo-500 hover:text-indigo-700 hover:bg-indigo-50'
        }`}
    >
      {selected && (
        <span className='w-[14px] h-[14px] inline-flex items-center justify-center rounded-full bg-white/25 flex-shrink-0'>
          <svg
            className='w-2.5 h-2.5 text-white'
            fill='none'
            viewBox='0 0 24 24'
            stroke='currentColor'
            strokeWidth={3}
          >
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              d='M5 13l4 4L19 7'
            />
          </svg>
        </span>
      )}
      {label}
    </button>
  );
}
