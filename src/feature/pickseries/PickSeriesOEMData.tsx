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
import {
  extractPickleOEMData,
  PICKLE_OEM_ITEMS,
} from '@/feature/pickseries/utils/pickle/extractPickleOEMData';
import { buildWeekMap, weekKeyOf } from '@/feature/pickseries/utils/weekKey';
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
  pickle: extractPickleOEMData,
};

// 서비스별로 아직 API 연동된 항목만 허용. 미등록 서비스(픽조이)는 전체 허용.
const SUPPORTED_OEM_ITEMS: Record<string, Set<string>> = {
  pickle: new Set(PICKLE_OEM_ITEMS),
};

const supportedOEMItemsOf = (productId: string, items: string[]): string[] => {
  const allow = SUPPORTED_OEM_ITEMS[productId];
  return allow ? items.filter((i) => allow.has(i)) : items;
};

export default function PickSeriesOEMData() {
  const { serverTokens } = usePickSeriesServerStore();

  const [productStates, setProductStates] = useState<
    Record<string, ProductState<OEMSheetData>>
  >({});
  // 정규 주차 키(가장 가까운 월요일) 기준으로 선택 상태를 관리한다.
  const [selectedWeeks, setSelectedWeeks] = useState<Set<string>>(new Set());
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
              oemMap[oem.name] = new Set(
                supportedOEMItemsOf(product.id, oem.items)
              );
            });
            setSelectedItemsByProduct((prev) => ({
              ...prev,
              [product.id]: oemMap,
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

  const toggleProductAll = useCallback(
    (productId: string) => {
      const data = productStates[productId]?.data;
      if (!data) return;
      setSelectedItemsByProduct((prev) => {
        const current = prev[productId] ?? {};
        const allSelected = data.oems.every((oem) =>
          supportedOEMItemsOf(productId, oem.items).every((item) =>
            current[oem.name]?.has(item)
          )
        );
        const next: Record<string, Set<string>> = {};
        data.oems.forEach((oem) => {
          const supp = supportedOEMItemsOf(productId, oem.items);
          next[oem.name] = allSelected ? new Set() : new Set(supp);
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
      const supp = supportedOEMItemsOf(productId, oem.items);
      setSelectedItemsByProduct((prev) => {
        const current = prev[productId] ?? {};
        const oemSet = current[oemName] ?? new Set<string>();
        const allSelected = supp.every((item) => oemSet.has(item));
        return {
          ...prev,
          [productId]: {
            ...current,
            [oemName]: allSelected ? new Set() : new Set(supp),
          },
        };
      });
    },
    [productStates]
  );

  const toggleOEMItem = useCallback(
    (productId: string, oemName: string, item: string) => {
      const allow = SUPPORTED_OEM_ITEMS[productId];
      if (allow && !allow.has(item)) return;
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

  // 전체 선택 (우상단 체크박스용) — 모든 product의 모든 OEM × 지원 항목
  const allSelectableItems = useMemo(() => {
    const result: { productId: string; oemName: string; item: string }[] = [];
    loggedInProducts.forEach((pg) => {
      productStates[pg.id]?.data?.oems.forEach((oem) =>
        supportedOEMItemsOf(pg.id, oem.items).forEach((item) =>
          result.push({ productId: pg.id, oemName: oem.name, item })
        )
      );
    });
    return result;
  }, [loggedInProducts, productStates]);

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
        if (data.oems.length === 0) return false;
        return data.oems.every((oem) => {
          const items = supportedOEMItemsOf(pg.id, oem.items);
          if (items.length === 0) return true;
          return items.every((item) =>
            data.existingData[actual]?.[oem.name]?.has(item)
          );
        });
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

  const allSelected = useMemo(
    () =>
      allSelectableItems.length > 0 &&
      allSelectableItems.every(({ productId, oemName, item }) =>
        selectedItemsByProduct[productId]?.[oemName]?.has(item)
      ) &&
      selectableWeeks.length > 0 &&
      selectableWeeks.every((wk) => selectedWeeks.has(wk)),
    [allSelectableItems, selectedItemsByProduct, selectableWeeks, selectedWeeks]
  );

  const toggleGlobalAll = useCallback(() => {
    setSelectedItemsByProduct((prev) => {
      const next = { ...prev };
      OEM_PRODUCT_GROUPS.forEach((pg) => {
        const oems = productStates[pg.id]?.data?.oems ?? [];
        const oemMap: Record<string, Set<string>> = {};
        oems.forEach((oem) => {
          const supp = supportedOEMItemsOf(pg.id, oem.items);
          oemMap[oem.name] = allSelected ? new Set() : new Set(supp);
        });
        next[pg.id] = oemMap;
      });
      return next;
    });
    setSelectedWeeks(allSelected ? new Set() : new Set(selectableWeeks));
  }, [allSelected, productStates, selectableWeeks]);

  const handleReset = useCallback(() => {
    setSelectedWeeks(new Set());
    setSelectedItemsByProduct((prev) => {
      const next = { ...prev };
      OEM_PRODUCT_GROUPS.forEach((pg) => {
        next[pg.id] = {};
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
        const selectedByOEM = selectedItemsByProduct[product.id] ?? {};
        // 선택된 주차 전부에 이미 값이 있는 항목은 제외
        const pendingByOEM: Record<string, Set<string>> = {};
        for (const [oemName, itemSet] of Object.entries(selectedByOEM)) {
          const pending = new Set(
            [...itemSet].filter(
              (item) =>
                !productDates.every((d) =>
                  data.existingData[d]?.[oemName]?.has(item)
                )
            )
          );
          if (pending.size > 0) pendingByOEM[oemName] = pending;
        }
        return { product, data, productDates, pendingByOEM };
      })
      .filter(
        (x) =>
          x.productDates.length > 0 && Object.keys(x.pendingByOEM).length > 0
      );

    if (plan.length === 0) {
      toast.info('선택한 주차·항목이 이미 모두 채워져 있습니다.');
      return;
    }

    setExtractionStatus('running');
    setExtractionProgress(null);
    setExtractionError(null);

    const failed: string[] = [];

    for (const { product, data, productDates, pendingByOEM } of plan) {
      const token = serverTokens[product.serverIds[0]]!;
      try {
        const results = await OEM_EXTRACTORS[product.id]({
          token,
          oems: data.oems,
          selectedItemsByOEM: pendingByOEM,
          dates: productDates,
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
    activeSelectedWeeks,
    weekMaps,
    refreshProduct,
  ]);

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
    (productId: string, oemName: string, item: string): string[] => {
      if (activeSelectedWeeks.length === 0) return [];
      const data = productStates[productId]?.data;
      if (!data) return [];
      return activeSelectedWeeks.filter((wk) => {
        const actual = weekMaps[productId]?.get(wk);
        return !!actual && data.existingData[actual]?.[oemName]?.has(item);
      });
    },
    [productStates, activeSelectedWeeks, weekMaps]
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
              {OEM_PRODUCT_GROUPS.map((product) => {
                const isConnected = loggedInProducts.some(
                  (p) => p.id === product.id
                );
                const state = productStates[product.id];
                const data = state?.data;
                const oems = data?.oems ?? [];

                const selectedItems = selectedItemsByProduct[product.id] ?? {};

                const supportedByOEM: Record<string, Set<string>> = {};
                const unsupported = new Set<string>();
                oems.forEach((oem) => {
                  const supp = supportedOEMItemsOf(product.id, oem.items);
                  supportedByOEM[oem.name] = new Set(supp);
                  oem.items.forEach((i) => {
                    if (!supp.includes(i)) unsupported.add(i);
                  });
                });

                const selectedCount = oems.reduce(
                  (sum, oem) =>
                    sum +
                    [...(supportedByOEM[oem.name] ?? [])].filter((item) =>
                      selectedItems[oem.name]?.has(item)
                    ).length,
                  0
                );
                const totalCount = oems.reduce(
                  (sum, oem) => sum + (supportedByOEM[oem.name]?.size ?? 0),
                  0
                );

                // 현재 선택으로는 추출되지 않는 항목 (담당 주차 없음 or 전부 존재)
                const productDates = activeSelectedWeeks
                  .map((wk) => weekMaps[product.id]?.get(wk))
                  .filter((d): d is string => !!d);
                const lockedItemsByOEM: Record<string, Set<string>> = {};
                oems.forEach((oem) => {
                  lockedItemsByOEM[oem.name] = new Set(
                    [...(supportedByOEM[oem.name] ?? [])].filter((item) => {
                      if (!data) return false;
                      if (productDates.length === 0) return true;
                      return productDates.every((d) =>
                        data.existingData[d]?.[oem.name]?.has(item)
                      );
                    })
                  );
                });

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
                    unsupportedItems={unsupported}
                    lockedItemsByOEM={lockedItemsByOEM}
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
