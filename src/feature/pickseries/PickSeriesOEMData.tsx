import { BottomBar } from '@/feature/pickseries/components/BottomBar';
import { DatePickerSection } from '@/feature/pickseries/components/DatePickerSection';
import ExtractionOverlay from '@/feature/pickseries/components/ExtractionOverlay';
import OEMCard from '@/feature/pickseries/components/OEMCard';
import PickSeriesPageHeader from '@/feature/pickseries/components/PickSeriesPageHeader';
import { OEM_PRODUCT_GROUPS } from '@/feature/pickseries/constants/pickSeriesProductGroups';
import { usePickSeriesServerStore } from '@/feature/pickseries/store/usePickSeriesServerStore';
import type {
  ExtractionStatus,
  OEMSelection,
  ProductGroup,
  ProductState,
} from '@/feature/pickseries/types/pickSeriesTypes';
import { isDateSelectable } from '@/feature/pickseries/utils/dateUtils';
import type {
  ExtractionProgress,
  OEMExtractionResult,
} from '@/feature/pickseries/utils/extractionTypes';
import {
  fetchPickSeriesOEMSheet,
  type OEMGroup,
  type OEMSheetData,
} from '@/feature/pickseries/utils/fetchPickSeriesOEMSheet';
import { extractPickjoyOEMData } from '@/feature/pickseries/utils/pickjoy/extractPickjoyOEMData';
import { writePickSeriesOEMSheet } from '@/feature/pickseries/utils/writePickSeriesOEMSheet';
import Message from '@/shared/components/common/Message';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';

type OEMExtractor = (p: {
  token: string;
  oems: OEMGroup[];
  selectedItemsByOEM: Record<string, Set<string>>;
  dates: string[];
  onProgress: (p: ExtractionProgress) => void;
}) => Promise<OEMExtractionResult>;

const OEM_EXTRACTORS: Record<string, OEMExtractor> = {
  pickjoy: extractPickjoyOEMData,
  // pickle: 주간지표 먼저. OEM API 연동 후 활성화.
};

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
        if (!data) return false;
        // 그 서비스 시트에 해당 주차가 없으면(운영 시작 전) 담당이 아니므로 통과
        if (!data.existingData[date]) return true;
        if (data.oems.length === 0) return false;
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
    const targets = loggedInProducts.filter((p) => {
      const data = productStates[p.id]?.data;
      const token = serverTokens[p.serverIds[0]];
      return OEM_EXTRACTORS[p.id] && data && token;
    });

    if (targets.length === 0) {
      toast.error(
        '추출 가능한 서버가 없습니다. 로그인·데이터 로드를 확인해주세요.'
      );
      return;
    }
    if (activeSelectedDates.length === 0) {
      toast.warn('추출할 주차를 선택해주세요.');
      return;
    }

    setExtractionStatus('running');
    setExtractionProgress(null);
    setExtractionError(null);

    const failed: string[] = [];

    for (const product of targets) {
      const data = productStates[product.id]!.data!;
      const token = serverTokens[product.serverIds[0]]!;
      const selectedItemsByOEM = selectedItemsByProduct[product.id] ?? {};
      const hasSelection = Object.values(selectedItemsByOEM).some(
        (set) => set.size > 0
      );
      if (!hasSelection) continue;

      try {
        const results = await OEM_EXTRACTORS[product.id]({
          token,
          oems: data.oems,
          selectedItemsByOEM,
          dates: activeSelectedDates,
          onProgress: setExtractionProgress,
        });
        await writePickSeriesOEMSheet(product.tabName, data, results);
        refreshProduct(product);
      } catch (err) {
        console.error(`[OEM지표] ${product.label} 추출 실패:`, err);
        failed.push(
          `${product.label}: ${err instanceof Error ? err.message : '알 수 없는 오류'}`
        );
      }
    }

    if (failed.length > 0) {
      setExtractionError(failed.join('\n'));
      setExtractionStatus('error');
    } else {
      setExtractionStatus('done');
    }
  }, [
    loggedInProducts,
    productStates,
    serverTokens,
    selectedItemsByProduct,
    activeSelectedDates,
    refreshProduct,
  ]);

  // 그 서비스가 담당하는(시트에 주차가 있는) 선택된 주차 수
  const coveredSelectedCount = useCallback(
    (productId: string): number =>
      activeSelectedDates.filter(
        (d) => productStates[productId]?.data?.existingData[d]
      ).length,
    [activeSelectedDates, productStates]
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
          <Message
            message='PickSeries 서버 로그인이 필요합니다.'
            type='warning'
          />
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
                    selectedDateCount={coveredSelectedCount(product.id)}
                    operatingSince={data?.dates[0]}
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
