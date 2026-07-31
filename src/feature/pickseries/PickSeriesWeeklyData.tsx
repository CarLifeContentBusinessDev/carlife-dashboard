import { BottomBar } from '@/feature/pickseries/components/BottomBar';
import WeeklyCard from '@/feature/pickseries/components/WeeklyCard';
import ExtractionOverlay from '@/feature/pickseries/components/ExtractionOverlay';
import { DatePickerSection } from '@/feature/pickseries/components/DatePickerSection';
import PickSeriesPageHeader from '@/feature/pickseries/components/PickSeriesPageHeader';
import type {
  ExtractionStatus,
  ProductGroup,
  ProductState,
} from '@/feature/pickseries/types/pickSeriesTypes';
import { usePickSeriesServerStore } from '@/feature/pickseries/store/usePickSeriesServerStore';
import {
  fetchPickSeriesWeeklySheet,
  type WeeklySheetData,
} from '@/feature/pickseries/utils/fetchPickSeriesWeeklySheet';
import { writePickSeriesWeeklySheet } from '@/feature/pickseries/utils/writePickSeriesWeeklySheet';
import { isDateSelectable } from '@/feature/pickseries/utils/dateUtils';
import type { ExtractionProgress } from '@/feature/pickseries/utils/extractPickjoyOEMData';
import { extractPickjoyWeeklyData } from '@/feature/pickseries/utils/extractPickjoyWeeklyData';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { WEEKLY_PRODUCT_GROUPS } from '@/feature/pickseries/constants/pickSeriesProductGroups';

export default function PickSeriesWeeklyData() {
  const { serverTokens } = usePickSeriesServerStore();

  const [productStates, setProductStates] = useState<
    Record<string, ProductState<WeeklySheetData>>
  >({});
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const [selectedItemsByProduct, setSelectedItemsByProduct] = useState<
    Record<string, Set<string>>
  >({});

  const [extractionStatus, setExtractionStatus] =
    useState<ExtractionStatus>('idle');
  const [extractionProgress, setExtractionProgress] =
    useState<ExtractionProgress | null>(null);
  const [extractionError, setExtractionError] = useState<string | null>(null);

  const fetchingProducts = useRef<Set<string>>(new Set());
  const initializedProducts = useRef<Set<string>>(new Set());

  const loggedInProducts = useMemo(
    () =>
      WEEKLY_PRODUCT_GROUPS.filter((pg) =>
        pg.serverIds.some((sid) => !!serverTokens[sid])
      ),
    [serverTokens]
  );

  useEffect(() => {
    loggedInProducts.forEach((product) => {
      if (initializedProducts.current.has(product.id)) return;
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
            err instanceof Error
              ? err.message
              : String((err as Record<string, unknown>)?.message ?? err);
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
  }, [loggedInProducts]);

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

  const selectableDates = useMemo(
    () => incompleteDates.filter(isDateSelectable),
    [incompleteDates]
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
      selectableDates.length > 0 &&
      selectableDates.every((d) => selectedDates.has(d)),
    [allItems, selectedItemsByProduct, selectableDates, selectedDates]
  );

  const toggleGlobalAll = useCallback(() => {
    setSelectedItemsByProduct((prev) => {
      const next = { ...prev };
      WEEKLY_PRODUCT_GROUPS.forEach((pg) => {
        const items = productStates[pg.id]?.data?.items ?? [];
        next[pg.id] = allSelected ? new Set() : new Set(items);
      });
      return next;
    });
    setSelectedDates(allSelected ? new Set() : new Set(selectableDates));
  }, [allSelected, productStates, selectableDates]);

  const handleReset = useCallback(() => {
    setSelectedDates(new Set());
    setSelectedItemsByProduct((prev) => {
      const next = { ...prev };
      WEEKLY_PRODUCT_GROUPS.forEach((pg) => {
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
      [product.id]: {
        data: prev[product.id]?.data ?? null,
        loading: true,
        error: null,
      },
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
        <PickSeriesPageHeader
          title='주간지표'
          description='시트의 빈 주차를 자동으로 감지하고 데이터를 채웁니다. (월-일 기준)'
        />

        {!hasAnyLoggedIn ? (
          <div className='rounded-xl border border-dashed border-gray-300 bg-white px-4 py-5'>
            <p className='text-gray-600 text-sm'>
              PickSeries 서버 로그인이 필요합니다.
            </p>
          </div>
        ) : (
          <>
            {/* 주차 선택 */}
            <DatePickerSection
              allDates={allDates}
              selectedDates={selectedDates}
              toggleDate={toggleDate}
              allSelected={allSelected}
              toggleGlobalAll={toggleGlobalAll}
              hasAnyLoggedIn={hasAnyLoggedIn}
              loggedInProducts={loggedInProducts}
              productStates={productStates}
              incompleteDates={incompleteDates}
              isDateSelectable={isDateSelectable}
            />

            {/* 서비스 카드 그리드 */}
            <div className='grid grid-cols-3 gap-4'>
              {WEEKLY_PRODUCT_GROUPS.map((product) => {
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
                const isActive = product.id === 'pickjoy' ? true : false;

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
                    isActive={isActive}
                  />
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* 하단 고정 바 */}
      {hasAnyLoggedIn && (
        <BottomBar
          handleReset={handleReset}
          activeSelectedDates={activeSelectedDates}
          onClick={handleExtract}
        />
      )}
    </div>
  );
}
