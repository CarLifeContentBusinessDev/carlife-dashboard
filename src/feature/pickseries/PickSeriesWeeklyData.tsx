import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Button from '@/components/common/Button';
import { useLoginTokenStore } from '@/store/useLoginTokenStore';
import { usePickSeriesServerStore } from '@/store/usePickSeriesServerStore';
import {
  fetchPickSeriesWeeklySheet,
  type WeeklySheetData,
} from '@/utils/googleSheets/fetchPickSeriesWeeklySheet';
import Card from '@/components/card/Card';

interface ProductGroup {
  id: string;
  label: string;
  tabName: string;
  serverIds: string[];
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
      ),
    [allItems, selectedItemsByProduct]
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
  }, [allSelected, productStates]);

  const handleReset = useCallback(() => {
    setSelectedDates(new Set());
    setSelectedItemsByProduct((prev) => {
      const next = { ...prev };
      PRODUCT_GROUPS.forEach((pg) => {
        const items = productStates[pg.id]?.data?.items ?? [];
        next[pg.id] = new Set(items);
      });
      return next;
    });
  }, [productStates]);

  const isItemExisting = useCallback(
    (productId: string, item: string): boolean => {
      if (selectedDates.size === 0) return false;
      const data = productStates[productId]?.data;
      if (!data) return false;
      return Array.from(selectedDates).some((date) =>
        data.existingData[date]?.has(item)
      );
    },
    [productStates, selectedDates]
  );

  const [hideCompleted, setHideCompleted] = useState(true);

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

  const visibleDates = useMemo(
    () =>
      hideCompleted ? allDates.filter((d) => !isDateFullyFilled(d)) : allDates,
    [allDates, hideCompleted, isDateFullyFilled]
  );

  const completedCount = useMemo(
    () => allDates.filter((d) => isDateFullyFilled(d)).length,
    [allDates, isDateFullyFilled]
  );

  const hasAnyLoggedIn = loggedInProducts.length > 0;

  return (
    <div className='flex flex-col min-h-full'>
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
                {completedCount > 0 && (
                  <button
                    onClick={() => setHideCompleted((prev) => !prev)}
                    className='flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium transition-colors cursor-pointer border-gray-300 bg-gray-50 text-gray-700 hover:bg-gray-100'
                  >
                    <span className='w-1.5 h-1.5 rounded-full bg-gray-500' />
                    완료 {completedCount}건 {hideCompleted ? '보기' : '숨기기'}
                  </button>
                )}
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
                ) : visibleDates.length === 0 ? (
                  <span className='text-sm text-gray-400'>
                    모든 주차가 완료되었습니다.
                  </span>
                ) : (
                  visibleDates.map((date) => {
                    const filled = isDateFullyFilled(date);
                    return (
                      <button
                        key={date}
                        onClick={() => toggleDate(date)}
                        className={`relative flex items-center gap-1.5 px-4 py-2 rounded-lg border text-sm font-medium transition-colors cursor-pointer ${
                          selectedDates.has(date)
                            ? filled
                              ? 'bg-gray-400 border-gray-300 text-white hover:border-gray-400'
                              : 'bg-indigo-600 border-indigo-600 text-white'
                            : filled
                              ? 'bg-white border-gray-300 text-gray-400 hover:border-gray-400'
                              : 'bg-white border-gray-300 text-gray-700 hover:border-indigo-400'
                        }`}
                      >
                        {filled && (
                          <svg
                            className={`w-3.5 h-3.5 shrink-0 ${selectedDates.has(date) ? 'text-white' : 'text-gray-500'}`}
                            viewBox='0 0 20 20'
                            fill='currentColor'
                          >
                            <path
                              fillRule='evenodd'
                              d='M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z'
                              clipRule='evenodd'
                            />
                          </svg>
                        )}
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
                  <Card
                    productId={product.id}
                    label={product.label}
                    isConnected={isConnected}
                    items={items}
                    selected={selected}
                    selectedCount={selectedCount}
                    state={state ?? { data: null, loading: false, error: null }}
                    onClick={toggleProductAll}
                    isItemExisting={isItemExisting}
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
                  {selectedDates.size > 0
                    ? `${selectedDates.size}개 주차 선택됨`
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
              disabled={selectedDates.size === 0}
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
