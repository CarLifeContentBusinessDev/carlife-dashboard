import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import Button from '@/components/common/Button';
import { useLoginTokenStore } from '@/store/useLoginTokenStore';
import { usePickSeriesServerStore } from '@/store/usePickSeriesServerStore';
import {
  fetchPickSeriesWeeklySheet,
  type WeeklySheetData,
} from '@/utils/googleSheets/fetchPickSeriesWeeklySheet';
import WeeklyCard from '@/components/card/WeeklyCard';
import { BottomBar } from '@/components/bottomBar/BottomBar';
import ExtractionOverlay from '@/components/overlay/ExtractionOverlay';
import { extractPickjoyWeeklyData } from '@/utils/pickseries/extractPickjoyWeeklyData';
import { writePickSeriesWeeklySheet } from '@/utils/googleSheets/writePickSeriesWeeklySheet';
import type { ExtractionProgress } from '@/utils/pickseries/extractPickjoyOEMData';

interface ProductGroup {
  id: string;
  label: string;
  tabName: string;
  serverIds: string[];
}

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

const PRODUCT_GROUPS: ProductGroup[] = [
  {
    id: 'pickle',
    label: '픽클',
    tabName: '픽클_주간지표',
    serverIds: ['pickle-prod'],
  },
  {
    id: 'picknow',
    label: '픽나우',
    tabName: '픽나우_주간지표',
    serverIds: ['picknow-kr-prod-kia', 'picknow-kr-prod', 'picknow-us-prod'],
  },
  {
    id: 'pickjoy',
    label: '픽조이',
    tabName: '픽조이_주간지표',
    serverIds: ['pickjoy'],
  },
];

interface ProductState {
  data: WeeklySheetData | null;
  loading: boolean;
  error: string | null;
}

export default function PickSeriesWeeklyData() {
  const { loginToken } = useLoginTokenStore();
  const { serverTokens } = usePickSeriesServerStore();

  const [productStates, setProductStates] = useState<
    Record<string, ProductState>
  >({});
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const [selectedItemsByProduct, setSelectedItemsByProduct] = useState<
    Record<string, Set<string>>
  >({});

  const [extractionStatus, setExtractionStatus] = useState<
    'idle' | 'running' | 'done' | 'error'
  >('idle');
  const [extractionProgress, setExtractionProgress] =
    useState<ExtractionProgress | null>(null);
  const [extractionError, setExtractionError] = useState<string | null>(null);

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

      fetchPickSeriesWeeklySheet(product.tabName)
        .then((data) => {
          setProductStates((prev) => ({
            ...prev,
            [product.id]: { data, loading: false, error: null },
          }));

          if (!initializedProducts.current.has(product.id)) {
            initializedProducts.current.add(product.id);
            setSelectedItemsByProduct((prev) => ({
              ...prev,
              [product.id]: new Set(data.items),
            }));
            setSelectedDates((prev) => {
              const next = new Set(prev);
              data.dates.filter(isDateSelectable).forEach((d) => next.add(d));
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
          console.error(`[WeeklySheet] ${product.label} 로드 실패:`, err);
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

  const toggleItem = useCallback((productId: string, item: string) => {
    setSelectedItemsByProduct((prev) => {
      const currentSet = new Set(prev[productId] ?? []);
      if (currentSet.has(item)) currentSet.delete(item);
      else currentSet.add(item);
      return { ...prev, [productId]: currentSet };
    });
  }, []);

  const toggleProductAll = useCallback(
    (productId: string) => {
      const items = productStates[productId]?.data?.items ?? [];
      setSelectedItemsByProduct((prev) => {
        const currentSet = prev[productId] ?? new Set<string>();
        const allSelected = items.every((item) => currentSet.has(item));
        return {
          ...prev,
          [productId]: allSelected ? new Set() : new Set(items),
        };
      });
    },
    [productStates]
  );

  const isDateFullyFilled = useCallback(
    (date: string): boolean =>
      loggedInProducts.length > 0 &&
      loggedInProducts.every((pg) => {
        const data = productStates[pg.id]?.data;
        if (!data || data.items.length === 0) return false;
        return data.items.every((item) => data.existingData[date]?.has(item));
      }),
    [loggedInProducts, productStates]
  );

  const incompleteDates = useMemo(
    () => allDates.filter((d) => !isDateFullyFilled(d)),
    [allDates, isDateFullyFilled]
  );

  const allItems = useMemo(() => {
    const result: { productId: string; item: string }[] = [];
    loggedInProducts.forEach((pg) => {
      (productStates[pg.id]?.data?.items ?? []).forEach((item) =>
        result.push({ productId: pg.id, item })
      );
    });
    return result;
  }, [loggedInProducts, productStates]);

  const allSelected = useMemo(
    () =>
      allItems.length > 0 &&
      allItems.every(({ productId, item }) =>
        selectedItemsByProduct[productId]?.has(item)
      ) &&
      incompleteDates.length > 0 &&
      incompleteDates.every((d) => selectedDates.has(d)),
    [allItems, selectedItemsByProduct, incompleteDates, selectedDates]
  );

  const toggleGlobalAll = useCallback(() => {
    setSelectedItemsByProduct((prev) => {
      const next = { ...prev };
      PRODUCT_GROUPS.forEach((pg) => {
        const items = productStates[pg.id]?.data?.items ?? [];
        next[pg.id] = allSelected ? new Set() : new Set(items);
      });
      return next;
    });
    setSelectedDates(allSelected ? new Set() : new Set(incompleteDates));
  }, [allSelected, productStates, incompleteDates]);

  const handleReset = useCallback(() => {
    setSelectedDates(new Set());
    setSelectedItemsByProduct((prev) => {
      const next = { ...prev };
      PRODUCT_GROUPS.forEach((pg) => {
        next[pg.id] = new Set();
      });
      return next;
    });
  }, []);

  const activeSelectedDates = useMemo(
    () =>
      incompleteDates.filter(
        (d) => isDateSelectable(d) && selectedDates.has(d)
      ),
    [incompleteDates, selectedDates]
  );

  const getItemExistingDates = useCallback(
    (productId: string, item: string): string[] => {
      if (activeSelectedDates.length === 0) return [];
      const data = productStates[productId]?.data;
      if (!data) return [];
      return activeSelectedDates.filter((date) =>
        data.existingData[date]?.has(item)
      );
    },
    [productStates, activeSelectedDates]
  );

  const handleExtractionReset = useCallback(() => {
    setExtractionStatus('idle');
    setExtractionProgress(null);
    setExtractionError(null);
  }, []);

  const refreshProduct = useCallback((product: ProductGroup) => {
    setProductStates((prev) => ({
      ...prev,
      [product.id]: { data: prev[product.id]?.data ?? null, loading: true, error: null },
    }));
    fetchPickSeriesWeeklySheet(product.tabName)
      .then((data) => {
        setProductStates((prev) => ({
          ...prev,
          [product.id]: { data, loading: false, error: null },
        }));
      })
      .catch((err: unknown) => {
        const message =
          (err instanceof Error ? err.message : null) ?? '알 수 없는 오류';
        setProductStates((prev) => ({
          ...prev,
          [product.id]: {
            data: prev[product.id]?.data ?? null,
            loading: false,
            error: message,
          },
        }));
      });
  }, []);

  const handleExtract = useCallback(async () => {
    const pickjoyProduct = loggedInProducts.find((p) => p.id === 'pickjoy');
    const pickjoyData = productStates['pickjoy']?.data;
    const pickjoyToken = serverTokens['pickjoy'];

    if (!pickjoyProduct) {
      toast.error(
        '픽조이 서버가 연결되지 않았습니다. 서버 연결 후 다시 시도해주세요.'
      );
      return;
    }
    if (!pickjoyData || !pickjoyToken) {
      toast.error(
        '픽조이 데이터를 불러오는 중입니다. 잠시 후 다시 시도해주세요.'
      );
      return;
    }

    const selectedItems =
      selectedItemsByProduct['pickjoy'] ?? new Set<string>();

    setExtractionStatus('running');
    setExtractionProgress(null);
    setExtractionError(null);

    try {
      const results = await extractPickjoyWeeklyData({
        token: pickjoyToken,
        selectedItems,
        dates: activeSelectedDates,
        onProgress: setExtractionProgress,
      });
      await writePickSeriesWeeklySheet(
        pickjoyProduct.tabName,
        pickjoyData,
        results
      );
      refreshProduct(pickjoyProduct);
      setExtractionStatus('done');
    } catch (err) {
      setExtractionError(
        err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.'
      );
      setExtractionStatus('error');
    }
  }, [
    loggedInProducts,
    productStates,
    serverTokens,
    selectedItemsByProduct,
    activeSelectedDates,
    refreshProduct,
  ]);

  const hasAnyLoggedIn = loggedInProducts.length > 0;

  return (
    <div className='relative flex flex-col min-h-full'>
      {extractionStatus !== 'idle' && (
        <ExtractionOverlay
          status={extractionStatus}
          progress={extractionProgress}
          errorMessage={extractionError}
          onReset={handleExtractionReset}
        />
      )}
      <div className='flex-1 p-6'>
        {/* 헤더 */}
        <div className='flex justify-between mb-5'>
          <div className='flex items-end gap-3'>
            <h1 className='text-2xl font-black text-[#1B1E2F]'>주간 지표</h1>
            <span className='text-sm text-slate-400 pb-0.5'>
              시트의 빈 주차를 자동으로 감지하고 데이터를 채웁니다. (월-일 기준)
            </span>
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
                const items = state?.data?.items ?? [];
                const selected =
                  selectedItemsByProduct[product.id] ?? new Set<string>();
                const selectedCount = items.filter((item) =>
                  selected.has(item)
                ).length;

                return (
                  <WeeklyCard
                    key={product.id}
                    productId={product.id}
                    label={product.label}
                    isConnected={isConnected}
                    items={items}
                    selected={selected}
                    selectedCount={selectedCount}
                    selectedDateCount={activeSelectedDates.length}
                    state={state ?? { data: null, loading: false, error: null }}
                    onClick={toggleProductAll}
                    getItemExistingDates={getItemExistingDates}
                    toggleItem={toggleItem}
                  />
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* 하단 고정 바 */}
      {loginToken && hasAnyLoggedIn && (
        <BottomBar
          handleReset={handleReset}
          activeSelectedDates={activeSelectedDates}
          onClick={handleExtract}
        />
      )}
    </div>
  );
}
