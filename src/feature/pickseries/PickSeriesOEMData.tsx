import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Button from '@/components/common/Button';
import { useLoginTokenStore } from '@/store/useLoginTokenStore';
import { usePickSeriesServerStore } from '@/store/usePickSeriesServerStore';
import {
  fetchPickSeriesOEMSheet,
  type OEMSheetData,
} from '@/utils/googleSheets/fetchPickSeriesOEMSheet';
import OEMCard from '@/components/card/OEMCard';

interface ProductGroup {
  id: string;
  label: string;
  tabName: string;
  serverIds: string[];
  excludedItems: string[];
}

const PRODUCT_GROUPS: ProductGroup[] = [
  {
    id: 'pickle',
    label: '픽클',
    tabName: '픽클_OEM지표',
    serverIds: ['pickle-prod'],
    excludedItems: ['표준 편차', '재방문 비율'],
  },
  {
    id: 'picknow',
    label: '픽나우',
    tabName: '픽나우_OEM지표',
    serverIds: ['picknow-kr-prod-kia', 'picknow-kr-prod', 'picknow-us-prod'],
    excludedItems: ['표준 편차', '재방문 비율'],
  },
  {
    id: 'pickjoy',
    label: '픽조이',
    tabName: '픽조이_OEM지표',
    serverIds: ['pickjoy'],
    excludedItems: ['표준 편차'],
  },
];

// productId → oemName → Set<itemName>
type OEMSelection = Record<string, Record<string, Set<string>>>;

// 주차 종료일(시작+6일)이 오늘보다 이전인 경우만 선택 가능
function isDateSelectable(date: string): boolean {
  const parts = date.split('.');
  if (parts.length < 3) return false;
  const [year, month, day] = parts.map(Number);
  if (!year || !month || !day) return false;
  const weekEnd = new Date(year, month - 1, day + 6);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return weekEnd < today;
}

interface ProductState {
  data: OEMSheetData | null;
  loading: boolean;
  error: string | null;
}

export default function PickSeriesOEMData() {
  const { loginToken } = useLoginTokenStore();
  const { serverTokens } = usePickSeriesServerStore();

  const [productStates, setProductStates] = useState<
    Record<string, ProductState>
  >({});
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const [selectedItemsByProduct, setSelectedItemsByProduct] =
    useState<OEMSelection>({});

  const fetchingProducts = useRef<Set<string>>(new Set());
  const initializedProducts = useRef<Set<string>>(new Set());

  const loggedInProducts = useMemo(
    () =>
      PRODUCT_GROUPS.filter((pg) =>
        pg.serverIds.some((sid) => !!serverTokens[sid])
      ),
    [serverTokens]
  );

  useEffect(() => {
    if (!loginToken) return;

    loggedInProducts.forEach((product) => {
      if (fetchingProducts.current.has(product.id)) return;

      fetchingProducts.current.add(product.id);

      setProductStates((prev) => ({
        ...prev,
        [product.id]: { data: null, loading: true, error: null },
      }));

      fetchPickSeriesOEMSheet(product.tabName, product.excludedItems)
        .then((data) => {
          setProductStates((prev) => ({
            ...prev,
            [product.id]: { data, loading: false, error: null },
          }));

          if (!initializedProducts.current.has(product.id)) {
            initializedProducts.current.add(product.id);
            const oemMap: Record<string, Set<string>> = {};
            data.oems.forEach((oem) => {
              oemMap[oem.name] = new Set(oem.items);
            });
            setSelectedItemsByProduct((prev) => ({
              ...prev,
              [product.id]: oemMap,
            }));
            const initialDates = data.dates.filter(isDateSelectable);
            setSelectedDates((prev) => {
              const next = new Set(prev);
              initialDates.forEach((d) => next.add(d));
              return next;
            });
          }

          fetchingProducts.current.delete(product.id);
        })
        .catch((err: unknown) => {
          const message =
            (err instanceof Error ? err.message : null) ??
            String((err as Record<string, unknown>)?.message ?? err) ??
            '알 수 없는 오류';
          console.error(`[OEMSheet] ${product.label} 로드 실패:`, err);
          setProductStates((prev) => ({
            ...prev,
            [product.id]: {
              data: null,
              loading: false,
              error: message || '데이터 로드 실패',
            },
          }));
          fetchingProducts.current.delete(product.id);
        });
    });
  }, [loginToken, loggedInProducts]);

  const allDates = useMemo(() => {
    const dateSet = new Set<string>();
    loggedInProducts.forEach((pg) => {
      productStates[pg.id]?.data?.dates.forEach((d) => dateSet.add(d));
    });
    return Array.from(dateSet).sort();
  }, [loggedInProducts, productStates]);

  const toggleDate = useCallback((date: string) => {
    if (!isDateSelectable(date)) return;
    setSelectedDates((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  }, []);

  const toggleProductAll = useCallback(
    (productId: string) => {
      const data = productStates[productId]?.data;
      if (!data) return;
      setSelectedItemsByProduct((prev) => {
        const current = prev[productId] ?? {};
        const allSelected = data.oems.every((oem) =>
          oem.items.every((item) => current[oem.name]?.has(item))
        );
        const next: Record<string, Set<string>> = {};
        data.oems.forEach((oem) => {
          next[oem.name] = allSelected ? new Set() : new Set(oem.items);
        });
        return { ...prev, [productId]: next };
      });
    },
    [productStates]
  );

  const toggleOEMAll = useCallback(
    (productId: string, oemName: string) => {
      const data = productStates[productId]?.data;
      if (!data) return;
      const oem = data.oems.find((o) => o.name === oemName);
      if (!oem) return;
      setSelectedItemsByProduct((prev) => {
        const current = prev[productId] ?? {};
        const oemSet = current[oemName] ?? new Set<string>();
        const allSelected = oem.items.every((item) => oemSet.has(item));
        return {
          ...prev,
          [productId]: {
            ...current,
            [oemName]: allSelected ? new Set() : new Set(oem.items),
          },
        };
      });
    },
    [productStates]
  );

  const toggleOEMItem = useCallback(
    (productId: string, oemName: string, item: string) => {
      setSelectedItemsByProduct((prev) => {
        const current = prev[productId] ?? {};
        const oemSet = new Set(current[oemName] ?? []);
        if (oemSet.has(item)) oemSet.delete(item);
        else oemSet.add(item);
        return { ...prev, [productId]: { ...current, [oemName]: oemSet } };
      });
    },
    []
  );

  // 전체 선택 (우상단 체크박스용) — 모든 product의 모든 OEM × 항목
  const allSelectableItems = useMemo(() => {
    const result: { productId: string; oemName: string; item: string }[] = [];
    loggedInProducts.forEach((pg) => {
      productStates[pg.id]?.data?.oems.forEach((oem) =>
        oem.items.forEach((item) =>
          result.push({ productId: pg.id, oemName: oem.name, item })
        )
      );
    });
    return result;
  }, [loggedInProducts, productStates]);

  const selectableDates = useMemo(
    () => allDates.filter((d) => isDateSelectable(d)),
    [allDates, isDateSelectable]
  );

  const allSelected = useMemo(
    () =>
      allSelectableItems.length > 0 &&
      allSelectableItems.every(({ productId, oemName, item }) =>
        selectedItemsByProduct[productId]?.[oemName]?.has(item)
      ) &&
      selectableDates.length > 0 &&
      selectableDates.every((d) => selectedDates.has(d)),
    [allSelectableItems, selectedItemsByProduct, selectableDates, selectedDates]
  );

  const toggleGlobalAll = useCallback(() => {
    setSelectedItemsByProduct((prev) => {
      const next = { ...prev };
      PRODUCT_GROUPS.forEach((pg) => {
        const oems = productStates[pg.id]?.data?.oems ?? [];
        const oemMap: Record<string, Set<string>> = {};
        oems.forEach((oem) => {
          oemMap[oem.name] = allSelected ? new Set() : new Set(oem.items);
        });
        next[pg.id] = oemMap;
      });
      return next;
    });
    setSelectedDates(allSelected ? new Set() : new Set(selectableDates));
  }, [allSelected, productStates, selectableDates]);

  const handleReset = useCallback(() => {
    setSelectedDates(new Set());
    setSelectedItemsByProduct((prev) => {
      const next = { ...prev };
      PRODUCT_GROUPS.forEach((pg) => {
        next[pg.id] = {};
      });
      return next;
    });
  }, []);

  const isDateFullyFilled = useCallback(
    (date: string): boolean =>
      loggedInProducts.length > 0 &&
      loggedInProducts.every((pg) => {
        const data = productStates[pg.id]?.data;
        if (!data || data.oems.length === 0) return false;
        return data.oems.every((oem) =>
          oem.items.every((item) =>
            data.existingData[date]?.[oem.name]?.has(item)
          )
        );
      }),
    [loggedInProducts, productStates]
  );

  const incompleteDates = useMemo(
    () => allDates.filter((d) => !isDateFullyFilled(d)),
    [allDates, isDateFullyFilled]
  );

  const activeSelectedDates = useMemo(
    () => incompleteDates.filter((d) => isDateSelectable(d) && selectedDates.has(d)),
    [incompleteDates, selectedDates]
  );

  const getItemExistingDates = useCallback(
    (productId: string, oemName: string, item: string): string[] => {
      if (activeSelectedDates.length === 0) return [];
      const data = productStates[productId]?.data;
      if (!data) return [];
      return activeSelectedDates.filter((date) =>
        data.existingData[date]?.[oemName]?.has(item)
      );
    },
    [productStates, activeSelectedDates]
  );

  const hasAnyLoggedIn = loggedInProducts.length > 0;

  return (
    <div className='flex flex-col min-h-full'>
      <div className='flex-1 p-6'>
        {/* 헤더 */}
        <div className='flex justify-between mb-5'>
          <div className='flex items-end gap-3'>
            <h1 className='text-2xl font-black text-[#1B1E2F]'>OEM 지표</h1>
            <span className='text-sm text-slate-400 pb-0.5'>
              시트의 빈 주차를 자동으로 감지하고 데이터를 채웁니다. (월-일 기준)
            </span>
          </div>
          <Button
            onClick={() =>
              window.open(
                `https://docs.google.com/spreadsheets/d/${import.meta.env.VITE_PICKSERIES_SPREADSHEET_ID}/edit`,
                '_blank'
              )
            }
          >
            스프레드 시트 바로가기
          </Button>
        </div>

        {!loginToken ? (
          <div className='rounded-xl border border-dashed border-gray-300 bg-white px-4 py-5'>
            <p className='text-gray-600 text-sm'>
              Google Sheets 로그인이 필요합니다.
            </p>
          </div>
        ) : (
          <>
            {/* 주차 선택 */}
            <div className='flex flex-col gap-2 mb-5'>
              <div className='flex items-center gap-3'>
                <span className='text-sm font-medium text-gray-500 shrink-0'>
                  주차 선택
                </span>
                {allDates.length > 0 && (
                  <label className='ml-auto flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer shrink-0'>
                    <input
                      type='checkbox'
                      checked={allSelected}
                      onChange={toggleGlobalAll}
                      className='w-4 h-4 accent-indigo-600'
                    />
                    전체 선택
                  </label>
                )}
              </div>
              <div className='flex gap-2 flex-wrap'>
                {!hasAnyLoggedIn ? (
                  <span className='text-sm text-gray-400'>
                    서버 연결 후 사용 가능합니다.
                  </span>
                ) : loggedInProducts.some(
                    (pg) => productStates[pg.id]?.loading
                  ) ? (
                  <span className='text-sm text-gray-400'>
                    날짜를 불러오는 중...
                  </span>
                ) : allDates.length === 0 ? (
                  <span className='text-sm text-gray-400'>
                    시트에서 날짜를 찾지 못했습니다. 브라우저 콘솔을
                    확인해주세요.
                  </span>
                ) : incompleteDates.length === 0 ? (
                  <span className='text-sm text-gray-400'>
                    모든 주차가 완료되었습니다.
                  </span>
                ) : (
                  incompleteDates.map((date) => {
                    const selectable = isDateSelectable(date);
                    return (
                      <button
                        key={date}
                        onClick={() => toggleDate(date)}
                        disabled={!selectable}
                        className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                          !selectable
                            ? 'bg-white border-gray-200 text-gray-300 cursor-not-allowed'
                            : selectedDates.has(date)
                              ? 'bg-indigo-600 border-indigo-600 text-white cursor-pointer'
                              : 'bg-white border-gray-300 text-gray-700 hover:border-indigo-400 cursor-pointer'
                        }`}
                      >
                        {date}
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* 서비스 카드 그리드 */}
            <div className='grid grid-cols-3 gap-4'>
              {PRODUCT_GROUPS.map((product) => {
                const isConnected = loggedInProducts.some(
                  (p) => p.id === product.id
                );
                const state = productStates[product.id];
                const data = state?.data;
                const oems = data?.oems ?? [];

                const selectedItems = selectedItemsByProduct[product.id] ?? {};
                const selectedCount = oems.reduce(
                  (sum, oem) =>
                    sum +
                    oem.items.filter((item) =>
                      selectedItems[oem.name]?.has(item)
                    ).length,
                  0
                );
                const totalCount = oems.reduce(
                  (sum, oem) => sum + oem.items.length,
                  0
                );

                return (
                  <OEMCard
                    key={product.id}
                    productId={product.id}
                    label={product.label}
                    isConnected={isConnected}
                    oems={oems}
                    selectedItems={selectedItems}
                    selectedCount={selectedCount}
                    totalCount={totalCount}
                    state={state ?? { loading: false, error: null }}
                    onToggleAll={toggleProductAll}
                    onToggleOEMAll={toggleOEMAll}
                    onToggleOEMItem={toggleOEMItem}
                    selectedDateCount={activeSelectedDates.length}
                    getItemExistingDates={getItemExistingDates}
                  />
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* 하단 고정 바 */}
      {loginToken && hasAnyLoggedIn && (
        <div className='sticky bottom-0 bg-white border-t border-gray-200 -mx-0 px-6 py-3 flex items-center justify-between z-10'>
          <div className='flex items-center gap-4'>
            {loggedInProducts.map((product) => (
              <div
                key={product.id}
                className='flex items-center gap-2 text-sm text-gray-600'
              >
                <span className='w-2 h-2 rounded-full bg-green-500 shrink-0' />
                <span>
                  {product.label} -{' '}
                  {activeSelectedDates.length > 0
                    ? `${activeSelectedDates.length}개 주차 선택됨`
                    : '주차 미선택'}
                </span>
              </div>
            ))}
          </div>
          <div className='flex items-center gap-2'>
            <button
              onClick={handleReset}
              className='px-4 py-2 rounded-lg border border-rose-300 text-rose-500 text-sm font-medium hover:bg-rose-50 transition-colors cursor-pointer'
            >
              X 초기화
            </button>
            <Button
              disabled={activeSelectedDates.length === 0}
              onClick={() => {
                // TODO: 데이터 추출 구현
              }}
            >
              데이터 추출 &gt;
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
