import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { useLoginTokenStore } from '@/store/useLoginTokenStore';
import { usePicknowServerStore } from '@/store/usePicknowServerStore';
import { PICKNOW_SERVERS } from '@/constants/servers';
import type { PicknowServer } from '@/constants/servers';
import type { SettingRow } from '@/utils/googleSheets/fetchSettingData';
import { fetchSettingData } from '@/utils/googleSheets/fetchSettingData';
import { syncPicknowConfigurationSheet } from '@/utils/googleSheets/syncPicknowConfigurationSheet';
import { getPicknowServerApi } from '@/utils/api/api';
import Button from '@/components/common/Button';
import ServerLoginModal from '@/components/common/ServerLoginModal';

export default function Configuration() {
  const { loginToken } = useLoginTokenStore();
  const {
    selectedServerIds,
    toggleSelectedServer,
    isServerLoggedIn,
    serverTokens,
  } = usePicknowServerStore();

  const selectedServers: PicknowServer[] = PICKNOW_SERVERS.filter((s) =>
    selectedServerIds.includes(s.id)
  );
  const loggedInSelectedServers = PICKNOW_SERVERS.filter(
    (s) => selectedServerIds.includes(s.id) && isServerLoggedIn(s.id)
  );

  const [loginModalServer, setLoginModalServer] =
    useState<PicknowServer | null>(null);
  const [sheetDropdownOpen, setSheetDropdownOpen] = useState(false);
  const sheetDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        sheetDropdownRef.current &&
        !sheetDropdownRef.current.contains(e.target as Node)
      ) {
        setSheetDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [rowsByServer, setRowsByServer] = useState<
    Record<string, SettingRow[]>
  >({});
  const [loading, setLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTabServerId, setActiveTabServerId] = useState<string | null>(
    null
  );
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [selectedDevicesByServer, setSelectedDevicesByServer] = useState<
    Record<string, Set<string>>
  >({});
  const [search, setSearch] = useState('');

  const activeServer =
    loggedInSelectedServers.find((s) => s.id === activeTabServerId) ??
    loggedInSelectedServers[0] ??
    null;

  const currentRows = activeServer ? (rowsByServer[activeServer.id] ?? []) : [];
  const currentSelectedDevices = activeServer
    ? (selectedDevicesByServer[activeServer.id] ?? new Set<string>())
    : new Set<string>();

  const setCurrentSelectedDevices = useCallback(
    (updater: Set<string> | ((prev: Set<string>) => Set<string>)) => {
      const serverId = activeServer?.id;
      if (!serverId) return;
      setSelectedDevicesByServer((prev) => {
        const prevSet = prev[serverId] ?? new Set<string>();
        const next = typeof updater === 'function' ? updater(prevSet) : updater;
        return { ...prev, [serverId]: next };
      });
    },
    [activeServer?.id]
  );

  const handleTabChange = (serverId: string) => {
    setActiveTabServerId(serverId);
    setSearch('');
    setCollapsed(new Set());
  };

  useEffect(() => {
    const loggedIn = PICKNOW_SERVERS.filter(
      (s) => selectedServerIds.includes(s.id) && isServerLoggedIn(s.id)
    );
    if (!loginToken || loggedIn.length === 0) return;

    if (
      !activeTabServerId ||
      !loggedIn.find((s) => s.id === activeTabServerId)
    ) {
      setActiveTabServerId(loggedIn[0].id);
    }

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const results = await Promise.all(
          loggedIn.map(async (s) => ({
            id: s.id,
            data: await fetchSettingData(s.spreadsheetId),
          }))
        );
        setRowsByServer((prev) => {
          const next = { ...prev };
          results.forEach(({ id, data }) => {
            next[id] = data;
          });
          return next;
        });
        setSelectedDevicesByServer((prev) => {
          const next: Record<string, Set<string>> = {};
          loggedIn.forEach((s) => {
            next[s.id] = prev[s.id] ?? new Set();
          });
          return next;
        });
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
  }, [loginToken, selectedServerIds.join(','), JSON.stringify(serverTokens)]);

  const handleExtractData = async () => {
    const { isServerLoggedIn: check } = usePicknowServerStore.getState();
    const targetServers = PICKNOW_SERVERS.filter(
      (s) => selectedServerIds.includes(s.id) && check(s.id)
    );

    if (targetServers.length === 0) {
      toast.error('로그인된 서버가 없습니다.');
      return;
    }

    const anySelected = targetServers.some(
      (s) => (selectedDevicesByServer[s.id]?.size ?? 0) > 0
    );
    if (!anySelected) {
      toast.error('데이터 추출할 디바이스를 먼저 선택해주세요.');
      return;
    }

    setExportLoading(true);
    const results: { success: string[]; failed: string[] } = {
      success: [],
      failed: [],
    };

    try {
      for (const server of targetServers) {
        const serverSelectedDevices =
          selectedDevicesByServer[server.id] ?? new Set<string>();
        if (serverSelectedDevices.size === 0) continue;

        const serverSelectedClients = [
          ...new Set(
            [...serverSelectedDevices].map((key) => key.split('::')[0])
          ),
        ]
          .filter(Boolean)
          .sort();
        const apiInstance = getPicknowServerApi(server);

        for (const customerName of serverSelectedClients) {
          const selections = [...serverSelectedDevices]
            .map((key) => {
              const [client, oem, device] = key.split('::');
              return { client, oem, device };
            })
            .filter((item) => item.client === customerName);

          if (selections.length === 0) {
            results.failed.push(`${server.label} / ${customerName}`);
            continue;
          }

          try {
            const syncResult = await syncPicknowConfigurationSheet(
              customerName,
              selections,
              apiInstance,
              server.spreadsheetId
            );
            results.success.push(`${server.label} / ${customerName}`);
            if (syncResult.failedBookmarkSeqs.length > 0) {
              console.warn(
                `[${server.label}] ${customerName} 일부 bookmark 상세 조회 실패:`,
                syncResult.failedBookmarkSeqs
              );
            }
          } catch (err) {
            console.error(
              `[${server.label}] ${customerName} 시트 생성 실패:`,
              err
            );
            results.failed.push(`${server.label} / ${customerName}`);
          }
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
    currentRows.forEach((row) => {
      if (!map[row.고객사]) map[row.고객사] = {};
      if (!map[row.고객사][row.OEM]) map[row.고객사][row.OEM] = [];
      if (!map[row.고객사][row.OEM].includes(row.DEVICE)) {
        map[row.고객사][row.OEM].push(row.DEVICE);
      }
    });
    return map;
  }, [currentRows]);

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

  const allDevicesSelected = useMemo(() => {
    if (allDeviceKeys.length === 0) return false;
    if (currentSelectedDevices.size !== allDeviceKeys.length) return false;
    return allDeviceKeys.every((k) => currentSelectedDevices.has(k));
  }, [currentSelectedDevices, allDeviceKeys]);

  const getOemState = (
    client: string,
    oem: string
  ): 'none' | 'partial' | 'all' => {
    const devices = grouped[client]?.[oem] ?? [];
    if (devices.length === 0) return 'none';
    const count = devices.filter((d) =>
      currentSelectedDevices.has(`${client}::${oem}::${d}`)
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
          currentSelectedDevices.has(`${client}::${oem}::${d}`)
        ).length,
      0
    );
    return { total, selected, oemCount: oems.length };
  };

  const toggleOEM = (client: string, oem: string) => {
    const devices = grouped[client]?.[oem] ?? [];
    const state = getOemState(client, oem);
    setCurrentSelectedDevices((prev) => {
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
    setCurrentSelectedDevices((prev) => {
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
    setCurrentSelectedDevices((prev) => {
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

  const handleResetAll = () => {
    setSelectedDevicesByServer({});
  };

  const totalSelectedCount = useMemo(
    () =>
      Object.values(selectedDevicesByServer).reduce(
        (sum, set) => sum + set.size,
        0
      ),
    [selectedDevicesByServer]
  );

  const serverSummaryItems = useMemo(() => {
    const loggedIn = PICKNOW_SERVERS.filter(
      (s) => selectedServerIds.includes(s.id) && isServerLoggedIn(s.id)
    );
    return loggedIn
      .map((server) => {
        const set = selectedDevicesByServer[server.id] ?? new Set<string>();

        const rows = rowsByServer[server.id] ?? [];
        const allKeysByClient: Record<string, string[]> = {};
        rows.forEach((row) => {
          if (!allKeysByClient[row.고객사]) allKeysByClient[row.고객사] = [];
          const key = `${row.고객사}::${row.OEM}::${row.DEVICE}`;
          if (!allKeysByClient[row.고객사].includes(key)) {
            allKeysByClient[row.고객사].push(key);
          }
        });

        const selectedByClient: Record<string, string[]> = {};
        [...set].forEach((key) => {
          const client = key.split('::')[0];
          if (!selectedByClient[client]) selectedByClient[client] = [];
          selectedByClient[client].push(key);
        });

        const items: string[] = [];
        Object.entries(selectedByClient)
          .sort(([a], [b]) => a.localeCompare(b))
          .forEach(([client, selectedKeys]) => {
            const totalKeys = allKeysByClient[client] ?? [];
            const isAllSelected =
              totalKeys.length > 0 &&
              selectedKeys.length === totalKeys.length &&
              totalKeys.every((k) => set.has(k));

            if (isAllSelected) {
              items.push(`${client} 전체`);
            } else {
              selectedKeys
                .map((key) => {
                  const parts = key.split('::');
                  return `${parts[1]}/${parts[2]}`;
                })
                .sort()
                .forEach((item) => items.push(item));
            }
          });

        return { server, items };
      })
      .filter(({ items }) => items.length > 0);
  }, [selectedDevicesByServer, selectedServerIds, serverTokens, rowsByServer]);

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
        {(() => {
          const loggedInServers = selectedServers.filter((s) =>
            isServerLoggedIn(s.id)
          );
          if (loggedInServers.length === 0) return null;
          if (loggedInServers.length === 1) {
            const s = loggedInServers[0];
            return (
              <Button
                onClick={() =>
                  window.open(
                    `https://docs.google.com/spreadsheets/d/${s.spreadsheetId}/edit`,
                    '_blank'
                  )
                }
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
        })()}
      </div>

      {/* 서버 선택 */}
      <div className='flex items-center gap-3 mb-5'>
        <span className='text-sm font-medium text-gray-500 shrink-0'>
          서버 선택
        </span>
        <div className='flex gap-2 flex-wrap'>
          {PICKNOW_SERVERS.map((server) => {
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

      {!loginToken ? (
        <div className='rounded-xl border border-dashed border-gray-300 bg-white px-4 py-5 flex flex-col gap-3'>
          <p className='text-gray-600 text-sm'>
            Google Sheets 로그인이 필요합니다.
          </p>
        </div>
      ) : loggedInSelectedServers.length === 0 ? (
        <div className='rounded-xl border border-dashed border-gray-300 bg-white px-4 py-5 flex flex-col gap-3'>
          <p className='text-gray-600 text-sm'>서버를 선택해 주세요</p>
        </div>
      ) : loading ? (
        <p className='text-sm text-gray-400'>데이터를 불러오는 중...</p>
      ) : error ? (
        <p className='text-sm text-red-500 bg-red-50 px-4 py-2 rounded-md'>
          {error}
        </p>
      ) : (
        <div className='flex flex-col gap-5'>
          {/* 서버 탭 */}
          {loggedInSelectedServers.length > 0 && (
            <div className='flex border-b border-gray-200 -mb-2'>
              {loggedInSelectedServers.map((server) => {
                const count = selectedDevicesByServer[server.id]?.size ?? 0;
                const isActive = activeServer?.id === server.id;
                return (
                  <button
                    key={server.id}
                    onClick={() => handleTabChange(server.id)}
                    className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px cursor-pointer ${
                      isActive
                        ? 'border-indigo-600 text-indigo-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {server.label}
                    {count > 0 && (
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                          isActive
                            ? 'bg-indigo-100 text-indigo-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

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
              onClick={() =>
                setCurrentSelectedDevices((prev) => {
                  const allSelected =
                    prev.size === allDeviceKeys.length &&
                    allDeviceKeys.every((k) => prev.has(k));
                  return allSelected ? new Set() : new Set(allDeviceKeys);
                })
              }
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-semibold border transition-colors cursor-pointer ${
                allDevicesSelected
                  ? 'bg-indigo-600 border-indigo-600 text-white hover:bg-indigo-700'
                  : 'text-slate-700 border-gray-200 bg-white hover:bg-gray-50'
              }`}
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
              {allDevicesSelected ? '전체 해제' : '전체 선택'}
            </button>

            <button
              onClick={() => setCurrentSelectedDevices(new Set())}
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
                                      selected={currentSelectedDevices.has(
                                        deviceKey
                                      )}
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
          {totalSelectedCount > 0 && (
            <div className='sticky bottom-4 bg-white border border-gray-200 rounded-xl px-4 py-3.5 flex items-center gap-3 shadow-[0_-8px_24px_rgba(15,23,42,0.06)]'>
              <div className='flex items-center gap-1.5 bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-full font-bold text-sm shrink-0'>
                <div className='w-1.5 h-1.5 rounded-full bg-indigo-600' />
                {totalSelectedCount} 개 선택됨
              </div>

              <div className='flex-1 min-w-0 flex items-center gap-2 flex-wrap'>
                {serverSummaryItems.flatMap(({ server, items }, idx) => [
                  idx > 0 && (
                    <div
                      key={`div-${server.id}`}
                      className='w-px h-4 bg-gray-200 shrink-0'
                    />
                  ),
                  loggedInSelectedServers.length > 1 && (
                    <span
                      key={`label-${server.id}`}
                      className='text-xs font-bold text-indigo-600  px-2 py-0.5 rounded shrink-0 whitespace-nowrap'
                    >
                      {server.label}
                    </span>
                  ),
                  ...items.map((item) => (
                    <span
                      key={`${server.id}-${item}`}
                      className='text-[11px] px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 border border-gray-200 font-medium whitespace-nowrap'
                    >
                      {item}
                    </span>
                  )),
                ])}
              </div>

              <button
                type='button'
                onClick={handleResetAll}
                className='flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-orange-500 hover:bg-gray-100 rounded-lg transition-colors shrink-0 cursor-pointer'
              >
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
                    d='M6 18L18 6M6 6l12 12'
                  />
                </svg>
                초기화
              </button>

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
      {loginModalServer && (
        <ServerLoginModal
          server={loginModalServer}
          onClose={() => {
            const server = loginModalServer;
            setLoginModalServer(null);
            if (
              server &&
              usePicknowServerStore.getState().isServerLoggedIn(server.id) &&
              !selectedServerIds.includes(server.id)
            ) {
              toggleSelectedServer(server.id);
            }
          }}
        />
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
