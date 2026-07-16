import { BottomBar } from '@/feature/pickseries/components/BottomBar';
import OEMCard from '@/feature/pickseries/components/OEMCard';
import ExtractionOverlay from '@/feature/pickseries/components/ExtractionOverlay';
import { DatePickerSection } from '@/feature/pickseries/components/DatePickerSection';
import PickSeriesPageHeader from '@/feature/pickseries/components/PickSeriesPageHeader';
import type {
  ExtractionStatus,
  OEMSelection,
  ProductGroup,
  ProductState,
} from '@/feature/pickseries/types/pickSeriesTypes';
import { usePickSeriesServerStore } from '@/feature/pickseries/store/usePickSeriesServerStore';
import {
  fetchPickSeriesOEMSheet,
  type OEMSheetData,
} from '@/feature/pickseries/utils/fetchPickSeriesOEMSheet';
import { writePickSeriesOEMSheet } from '@/feature/pickseries/utils/writePickSeriesOEMSheet';
import { isDateSelectable } from '@/feature/pickseries/utils/dateUtils';
import {
  extractPickjoyOEMData,
  type ExtractionProgress,
} from '@/feature/pickseries/utils/extractPickjoyOEMData';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { OEM_PRODUCT_GROUPS } from '@/feature/pickseries/constants/pickSeriesProductGroups';

export default function PickSeriesOEMData() {
  const { serverTokens } = usePickSeriesServerStore();

  const [productStates, setProductStates] = useState<
    Record<string, ProductState<OEMSheetData>>
  >({});
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const [selectedItemsByProduct, setSelectedItemsByProduct] =
    useState<OEMSelection>({});

  const [extractionStatus, setExtractionStatus] =
    useState<ExtractionStatus>('idle');
  const [extractionProgress, setExtractionProgress] =
    useState<ExtractionProgress | null>(null);
  const [extractionError, setExtractionError] = useState<string | null>(null);

  const fetchingProducts = useRef<Set<string>>(new Set());
  const initializedProducts = useRef<Set<string>>(new Set());

  const loggedInProducts = useMemo(
    () =>
      OEM_PRODUCT_GROUPS.filter((pg) =>
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
            err instanceof Error
              ? err.message
              : String((err as Record<string, unknown>)?.message ?? err);
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

  const selectableDates = useMemo(
    () => incompleteDates.filter(isDateSelectable),
    [incompleteDates]
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
      OEM_PRODUCT_GROUPS.forEach((pg) => {
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
      OEM_PRODUCT_GROUPS.forEach((pg) => {
        next[pg.id] = {};
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
    fetchPickSeriesOEMSheet(product.tabName, product.excludedItems)
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

    const selectedItemsByOEM = selectedItemsByProduct['pickjoy'] ?? {};

    setExtractionStatus('running');
    setExtractionProgress(null);
    setExtractionError(null);

    try {
      const results = await extractPickjoyOEMData({
        token: pickjoyToken,
        oems: pickjoyData.oems,
        selectedItemsByOEM,
        dates: activeSelectedDates,
        onProgress: setExtractionProgress,
      });
      await writePickSeriesOEMSheet(
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
          title='OEM 지표'
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
              {OEM_PRODUCT_GROUPS.map((product) => {
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
