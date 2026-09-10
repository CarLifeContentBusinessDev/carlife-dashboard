import { BottomBar } from '@/feature/pickseries/components/BottomBar';
import { DatePickerSection } from '@/feature/pickseries/components/DatePickerSection';
import ExtractionOverlay from '@/feature/pickseries/components/ExtractionOverlay';
import PickSeriesPageHeader from '@/feature/pickseries/components/PickSeriesPageHeader';
import WeeklyCard from '@/feature/pickseries/components/WeeklyCard';
import { WEEKLY_PRODUCT_GROUPS } from '@/feature/pickseries/constants/pickSeriesProductGroups';
import { usePickSeriesServerStore } from '@/feature/pickseries/store/usePickSeriesServerStore';
import type {
  ExtractionStatus,
  ProductGroup,
  ProductState,
} from '@/feature/pickseries/types/pickSeriesTypes';
import { isDateSelectable } from '@/feature/pickseries/utils/dateUtils';
import type {
  ExtractionProgress,
  WeeklyExtractionResult,
} from '@/feature/pickseries/utils/extractionTypes';
import {
  fetchPickSeriesWeeklySheet,
  type WeeklySheetData,
} from '@/feature/pickseries/utils/fetchPickSeriesWeeklySheet';
import { extractPickjoyWeeklyData } from '@/feature/pickseries/utils/pickjoy/extractPickjoyWeeklyData';
import {
  extractPickleWeeklyData,
  PICKLE_WEEKLY_ITEMS,
} from '@/feature/pickseries/utils/pickle/extractPickleWeeklyData';
import { buildWeekMap, weekKeyOf } from '@/feature/pickseries/utils/weekKey';
import { writePickSeriesWeeklySheet } from '@/feature/pickseries/utils/writePickSeriesWeeklySheet';
import Message from '@/shared/components/common/Message';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';

type WeeklyExtractor = (p: {
  token: string;
  selectedItems: Set<string>;
  dates: string[];
  onProgress: (p: ExtractionProgress) => void;
}) => Promise<WeeklyExtractionResult>;

const WEEKLY_EXTRACTORS: Record<string, WeeklyExtractor> = {
  pickjoy: extractPickjoyWeeklyData,
  pickle: extractPickleWeeklyData,
};

// 서비스별로 아직 API 연동된 항목만 허용. 미등록 서비스(픽조이)는 전체 허용.
const SUPPORTED_WEEKLY_ITEMS: Record<string, Set<string>> = {
  pickle: new Set(PICKLE_WEEKLY_ITEMS),
};

const supportedItemsOf = (productId: string, items: string[]): string[] => {
  const allow = SUPPORTED_WEEKLY_ITEMS[productId];
  return allow ? items.filter((i) => allow.has(i)) : items;
};

export default function PickSeriesWeeklyData() {
  const { serverTokens } = usePickSeriesServerStore();

  const [productStates, setProductStates] = useState<
    Record<string, ProductState<WeeklySheetData>>
  >({});
  // 정규 주차 키(가장 가까운 월요일) 기준으로 선택 상태를 관리한다.
  const [selectedWeeks, setSelectedWeeks] = useState<Set<string>>(new Set());
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
              [product.id]: new Set(
                supportedItemsOf(product.id, data.items)
              ),
            }));
            setSelectedWeeks((prev) => {
              const next = new Set(prev);
              data.dates
                .map(weekKeyOf)
                .filter(isDateSelectable)
                .forEach((wk) => next.add(wk));
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

  // 서비스별 정규 주차 키 → 실제 시트 시작일 매핑
  const weekMaps = useMemo(() => {
    const maps: Record<string, Map<string, string>> = {};
    loggedInProducts.forEach((pg) => {
      const dates = productStates[pg.id]?.data?.dates;
      if (dates) maps[pg.id] = buildWeekMap(dates);
    });
    return maps;
  }, [loggedInProducts, productStates]);

  const allWeeks = useMemo(() => {
    const set = new Set<string>();
    loggedInProducts.forEach((pg) => {
      productStates[pg.id]?.data?.dates.forEach((d) => set.add(weekKeyOf(d)));
    });
    return Array.from(set).sort();
  }, [loggedInProducts, productStates]);

  const toggleWeek = useCallback((weekKey: string) => {
    if (!isDateSelectable(weekKey)) return;
    setSelectedWeeks((prev) => {
      const next = new Set(prev);
      if (next.has(weekKey)) next.delete(weekKey);
      else next.add(weekKey);
      return next;
    });
  }, []);

  const toggleItem = useCallback((productId: string, item: string) => {
    const allow = SUPPORTED_WEEKLY_ITEMS[productId];
    if (allow && !allow.has(item)) return;
    setSelectedItemsByProduct((prev) => {
      const currentSet = new Set(prev[productId] ?? []);
      if (currentSet.has(item)) currentSet.delete(item);
      else currentSet.add(item);
      return { ...prev, [productId]: currentSet };
    });
  }, []);

  const toggleProductAll = useCallback(
    (productId: string) => {
      const items = supportedItemsOf(
        productId,
        productStates[productId]?.data?.items ?? []
      );
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

  // 정규 주차 키가 모든 서비스에서 (담당 항목 기준) 채워졌는지
  const isWeekFullyFilled = useCallback(
    (weekKey: string): boolean =>
      loggedInProducts.length > 0 &&
      loggedInProducts.every((pg) => {
        const data = productStates[pg.id]?.data;
        if (!data) return false;
        const actual = weekMaps[pg.id]?.get(weekKey);
        // 이 서비스 시트에 해당 주차가 없으면(운영 시작 전/미담당) 통과
        if (!actual || !data.existingData[actual]) return true;
        const items = supportedItemsOf(pg.id, data.items);
        if (items.length === 0) return false;
        return items.every((item) => data.existingData[actual]?.has(item));
      }),
    [loggedInProducts, productStates, weekMaps]
  );

  const incompleteWeeks = useMemo(
    () => allWeeks.filter((wk) => !isWeekFullyFilled(wk)),
    [allWeeks, isWeekFullyFilled]
  );

  const selectableWeeks = useMemo(
    () => incompleteWeeks.filter(isDateSelectable),
    [incompleteWeeks]
  );

  const allItems = useMemo(() => {
    const result: { productId: string; item: string }[] = [];
    loggedInProducts.forEach((pg) => {
      supportedItemsOf(
        pg.id,
        productStates[pg.id]?.data?.items ?? []
      ).forEach((item) => result.push({ productId: pg.id, item }));
    });
    return result;
  }, [loggedInProducts, productStates]);

  const allSelected = useMemo(
    () =>
      allItems.length > 0 &&
      allItems.every(({ productId, item }) =>
        selectedItemsByProduct[productId]?.has(item)
      ) &&
      selectableWeeks.length > 0 &&
      selectableWeeks.every((wk) => selectedWeeks.has(wk)),
    [allItems, selectedItemsByProduct, selectableWeeks, selectedWeeks]
  );

  const toggleGlobalAll = useCallback(() => {
    setSelectedItemsByProduct((prev) => {
      const next = { ...prev };
      WEEKLY_PRODUCT_GROUPS.forEach((pg) => {
        const items = supportedItemsOf(
          pg.id,
          productStates[pg.id]?.data?.items ?? []
        );
        next[pg.id] = allSelected ? new Set() : new Set(items);
      });
      return next;
    });
    setSelectedWeeks(allSelected ? new Set() : new Set(selectableWeeks));
  }, [allSelected, productStates, selectableWeeks]);

  const handleReset = useCallback(() => {
    setSelectedWeeks(new Set());
    setSelectedItemsByProduct((prev) => {
      const next = { ...prev };
      WEEKLY_PRODUCT_GROUPS.forEach((pg) => {
        next[pg.id] = new Set();
      });
      return next;
    });
  }, []);

  const activeSelectedWeeks = useMemo(
    () =>
      incompleteWeeks.filter(
        (wk) => isDateSelectable(wk) && selectedWeeks.has(wk)
      ),
    [incompleteWeeks, selectedWeeks]
  );

  // 그 서비스가 담당하는(시트에 주차가 있는) 선택된 주차 수
  const coveredSelectedCount = useCallback(
    (productId: string): number =>
      activeSelectedWeeks.filter((wk) => {
        const actual = weekMaps[productId]?.get(wk);
        return !!actual && !!productStates[productId]?.data?.existingData[actual];
      }).length,
    [activeSelectedWeeks, productStates, weekMaps]
  );

  const getItemExistingDates = useCallback(
    (productId: string, item: string): string[] => {
      if (activeSelectedWeeks.length === 0) return [];
      const data = productStates[productId]?.data;
      if (!data) return [];
      return activeSelectedWeeks.filter((wk) => {
        const actual = weekMaps[productId]?.get(wk);
        return !!actual && data.existingData[actual]?.has(item);
      });
    },
    [productStates, activeSelectedWeeks, weekMaps]
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
    const targets = loggedInProducts.filter((p) => {
      const data = productStates[p.id]?.data;
      const token = serverTokens[p.serverIds[0]];
      return WEEKLY_EXTRACTORS[p.id] && data && token;
    });

    if (targets.length === 0) {
      toast.error(
        '추출 가능한 서버가 없습니다. 로그인·데이터 로드를 확인해주세요.'
      );
      return;
    }
    if (activeSelectedWeeks.length === 0) {
      toast.warn('추출할 주차를 선택해주세요.');
      return;
    }

    const plan = targets
      .map((product) => {
        const data = productStates[product.id]!.data!;
        const weekMap = weekMaps[product.id] ?? new Map<string, string>();
        // 이 서비스가 담당하는 주차만 실제 시트 시작일로 변환 (픽클=월, 픽조이=일)
        const productDates = activeSelectedWeeks
          .map((wk) => weekMap.get(wk))
          .filter((d): d is string => !!d);
        const selected =
          selectedItemsByProduct[product.id] ?? new Set<string>();
        // 선택된 주차 전부에 이미 값이 있는 항목은 제외
        const pendingItems = new Set(
          [...selected].filter(
            (item) => !productDates.every((d) => data.existingData[d]?.has(item))
          )
        );
        return { product, data, productDates, pendingItems };
      })
      .filter((x) => x.productDates.length > 0 && x.pendingItems.size > 0);

    if (plan.length === 0) {
      toast.info('선택한 주차·항목이 이미 모두 채워져 있습니다.');
      return;
    }

    setExtractionStatus('running');
    setExtractionProgress(null);
    setExtractionError(null);

    const failed: string[] = [];

    for (const { product, data, productDates, pendingItems } of plan) {
      const token = serverTokens[product.serverIds[0]]!;
      try {
        const results = await WEEKLY_EXTRACTORS[product.id]({
          token,
          selectedItems: pendingItems,
          dates: productDates,
          onProgress: setExtractionProgress,
        });
        await writePickSeriesWeeklySheet(product.tabName, data, results);
        refreshProduct(product);
      } catch (err) {
        console.error(`[주간지표] ${product.label} 추출 실패:`, err);
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
    activeSelectedWeeks,
    weekMaps,
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
          description='시트의 빈 주차를 자동으로 감지하고 데이터를 채웁니다. (서비스별 주 시작 요일 자동 정렬)'
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
              allDates={allWeeks}
              selectedDates={selectedWeeks}
              toggleDate={toggleWeek}
              allSelected={allSelected}
              toggleGlobalAll={toggleGlobalAll}
              hasAnyLoggedIn={hasAnyLoggedIn}
              loggedInProducts={loggedInProducts}
              productStates={productStates}
              incompleteDates={incompleteWeeks}
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
                const supported = new Set(
                  supportedItemsOf(product.id, items)
                );
                const unsupported = new Set(
                  items.filter((i) => !supported.has(i))
                );
                const selected =
                  selectedItemsByProduct[product.id] ?? new Set<string>();
                const selectedCount = [...supported].filter((item) =>
                  selected.has(item)
                ).length;
                const isActive = product.id === 'picknow' ? false : true;

                // 현재 선택으로는 추출되지 않는 항목 (담당 주차 없음 or 전부 이미 존재)
                // → 체크된 채로 회색 비활성 표시
                const productDates = activeSelectedWeeks
                  .map((wk) => weekMaps[product.id]?.get(wk))
                  .filter((d): d is string => !!d);
                const lockedItems = new Set(
                  [...supported].filter((item) => {
                    if (!state?.data) return false;
                    if (productDates.length === 0) return true;
                    return productDates.every((d) =>
                      state.data!.existingData[d]?.has(item)
                    );
                  })
                );

                return (
                  <WeeklyCard
                    key={product.id}
                    productId={product.id}
                    label={product.label}
                    isConnected={isConnected}
                    items={items}
                    selected={selected}
                    selectedCount={selectedCount}
                    selectedDateCount={coveredSelectedCount(product.id)}
                    operatingSince={state?.data?.dates[0]}
                    state={state ?? { data: null, loading: false, error: null }}
                    onClick={toggleProductAll}
                    getItemExistingDates={getItemExistingDates}
                    toggleItem={toggleItem}
                    isActive={isActive}
                    unsupportedItems={unsupported}
                    lockedItems={lockedItems}
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
          activeSelectedDates={activeSelectedWeeks}
          onClick={handleExtract}
        />
      )}
    </div>
  );
}
