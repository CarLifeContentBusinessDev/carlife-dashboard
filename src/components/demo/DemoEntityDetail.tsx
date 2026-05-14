import LoadingOverlay from '@/components/common/LoadingOverlay';
import Dropdown from '@/components/common/Dropdown';
import DemoTableList from '@/components/demo/DemoTableList';
import { LANGUAGES } from '@/constants/languages';
import { supabase } from '@/lib/supabase';
import { useAccessTokenStore } from '@/store/useAccessTokenStore';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';

export type RelatedListQuery =
  | {
      type: 'direct';
      filterColumn: string;
      select?: string;
    }
  | {
      type: 'junction';
      junctionTable: string;
      junctionKey: string;
      junctionForeignKey: string;
      select?: string;
    };

export interface RelatedListConfig {
  title: string;
  tableName: string;
  detailPath: string;
  editPath: string;
  columns: { key: string; label: string }[];
  gridCols: string;
  query: RelatedListQuery;
  enableLangFilter?: boolean;
}

interface DemoEntityDetailProps {
  parentMenu: string;
  childMenu: string;
  tableName: string;
  listPath: string;
  editPath: string;
  select?: string;
  fieldLabels?: Record<string, string>;
  fieldOrder?: string[];
  hiddenFields?: string[];
  summaryFields?: SummaryField[];
  relatedList?: RelatedListConfig[];
}

interface SummaryField {
  key: string | string[];
  label: string;
  type?: 'text' | 'badge';
}

interface DisplayEntry {
  key: string;
  label: string;
  value: unknown;
  formatted: string;
  isImage: boolean;
  isAudio: boolean;
  isBadge: boolean;
  isWide: boolean;
}

interface DisplayRow {
  mode: 'single' | 'pair';
  items: DisplayEntry[];
}

const LABEL_COLUMN_CLASS = 'grid-cols-[170px_1fr]';
const BADGE_FIELDS = new Set(['is_active', 'is_searchable']);

const hasRenderableValue = (value: unknown) => {
  if (value == null) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.length > 0;
  return true;
};

const formatPrimitive = (value: unknown): string => {
  if (value == null) return '-';
  if (typeof value === 'boolean') return value ? 'O' : 'X';
  return String(value);
};

const formatObjectValue = (value: Record<string, unknown>): string => {
  const visibleEntries = Object.entries(value).filter(
    ([, v]) => v != null && !(typeof v === 'string' && v.trim() === '')
  );

  if (visibleEntries.length === 0) return '-';

  const title = value.title;
  const channel = value.channel;
  if (title || channel) {
    return [title, channel].filter(Boolean).map(formatPrimitive).join(' ');
  }

  if (visibleEntries.length === 1) {
    return formatPrimitive(visibleEntries[0][1]);
  }

  return visibleEntries
    .map(([k, v]) => `${k}: ${formatPrimitive(v)}`)
    .join(', ');
};

const formatValue = (value: unknown): string => {
  if (Array.isArray(value)) {
    if (value.length === 0) return '-';

    const formatted = value.map((item) => {
      if (item && typeof item === 'object') {
        return formatObjectValue(item as Record<string, unknown>);
      }
      return formatPrimitive(item);
    });

    return formatted.join(', ');
  }

  if (value && typeof value === 'object') {
    return formatObjectValue(value as Record<string, unknown>);
  }

  return formatPrimitive(value);
};

const isDateLikeField = (key: string, value: unknown) => {
  if (!(typeof value === 'string' || typeof value === 'number')) return false;

  const normalizedKey = key.toLowerCase();
  const dateKeyPattern = /(date|time|dtime|_at)$/;
  if (!dateKeyPattern.test(normalizedKey)) return false;

  const date = new Date(value);
  return !Number.isNaN(date.getTime());
};

const formatDateToKST = (value: string | number) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';

  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get(
    'minute'
  )}:${get('second')}`;
};

const formatFieldValue = (key: string, value: unknown) => {
  if (isDateLikeField(key, value)) {
    const formatted = formatDateToKST(value as string | number);
    if (formatted) return formatted;
  }

  return formatValue(value);
};

const isImageField = (key: string, value: unknown) => {
  if (typeof value !== 'string') return false;
  const normalizedKey = key.toLowerCase();
  if (normalizedKey.includes('img') || normalizedKey.includes('image')) {
    return value.startsWith('http://') || value.startsWith('https://');
  }

  return /\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i.test(value);
};

const isAudioField = (key: string, value: unknown) => {
  if (typeof value !== 'string') return false;
  const trimmedValue = value.trim();
  if (!trimmedValue) return false;

  if (/\.(mp3|wav|m4a|aac|ogg|flac)(\?.*)?$/i.test(trimmedValue)) {
    return true;
  }

  const normalizedKey = key.toLowerCase();
  if (
    normalizedKey.includes('audio') ||
    normalizedKey.includes('voice') ||
    normalizedKey.includes('sound')
  ) {
    return (
      trimmedValue.startsWith('http://') || trimmedValue.startsWith('https://')
    );
  }

  return false;
};

const isWideField = (entry: DisplayEntry) => {
  if (entry.isImage) return true;
  if (entry.isAudio) return true;

  const normalizedKey = entry.key.toLowerCase();
  if (
    normalizedKey.includes('desc') ||
    normalizedKey.includes('content') ||
    normalizedKey.includes('script') ||
    normalizedKey.includes('audio')
  ) {
    return true;
  }

  if (entry.formatted.includes('\n')) return true;
  return entry.formatted.length > 36;
};

const ImagePreview = ({ url }: { url: string }) => {
  const [imgError, setImgError] = useState(false);

  return (
    <div className='flex flex-col gap-2'>
      <div className='w-44 h-44 rounded-xl border border-gray-200 bg-white flex items-center justify-center overflow-hidden'>
        {!imgError ? (
          <img
            src={url}
            alt='thumbnail-preview'
            className='w-full h-full object-cover'
            onError={() => setImgError(true)}
          />
        ) : (
          <div className='text-xs text-gray-400 text-center'>
            이미지를 불러올 수 없습니다
          </div>
        )}
      </div>
    </div>
  );
};

const AudioPreview = ({ url }: { url: string }) => {
  return (
    <div className='w-full max-w-xl'>
      <audio controls preload='metadata' className='w-full'>
        <source src={url} />
        브라우저에서 오디오 재생을 지원하지 않습니다.
      </audio>
    </div>
  );
};

const parseId = (rawId: string): string | number => {
  if (/^\d+$/.test(rawId)) return Number(rawId);
  return rawId;
};

const getBadgeClassName = (value: string) => {
  const normalized = value.toLowerCase();
  if (normalized === 'active' || normalized === '활성') {
    return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  }
  if (normalized === 'inactive' || normalized === '비활성') {
    return 'bg-red-100 text-red-700 border-red-200';
  }
  return 'bg-indigo-100 text-indigo-700 border-indigo-200';
};

const isBadgeField = (key: string) => BADGE_FIELDS.has(key);

const formatBadgeValue = (value: unknown) => {
  if (typeof value === 'boolean') {
    return value ? 'Active' : 'Inactive';
  }

  if (typeof value === 'number') {
    return value === 0 ? 'Inactive' : 'Active';
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (
      ['active', 'true', '1', 'yes', 'y', 'on', '활성', '가능'].includes(
        normalized
      )
    ) {
      return 'Active';
    }

    if (
      ['inactive', 'false', '0', 'no', 'n', 'off', '비활성', '불가능'].includes(
        normalized
      )
    ) {
      return 'Inactive';
    }
  }

  return formatValue(value);
};

const resolveSummaryValue = (
  row: Record<string, unknown>,
  keys: string | string[]
) => {
  const candidates = Array.isArray(keys) ? keys : [keys];

  for (const key of candidates) {
    const value = row[key];
    if (hasRenderableValue(value)) {
      return { key, value };
    }
  }

  return null;
};

const DemoEntityDetail = ({
  parentMenu,
  childMenu,
  tableName,
  listPath,
  editPath,
  select = '*',
  fieldLabels = {},
  fieldOrder = [],
  hiddenFields = [],
  summaryFields = [],
  relatedList = [],
}: DemoEntityDetailProps) => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const lang = searchParams.get('lang') ?? 'all';
  const { accessToken } = useAccessTokenStore();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [row, setRow] = useState<Record<string, unknown> | null>(null);

  const [relatedData, setRelatedData] = useState<
    Record<number, Record<string, unknown>[]>
  >({});
  const [relatedLoading, setRelatedLoading] = useState<
    Record<number, boolean>
  >({});
  const [relatedLang, setRelatedLang] = useState<Record<number, string>>({});

  useEffect(() => {
    const fetchDetail = async () => {
      if (!id) return;

      setLoading(true);
      setError('');
      try {
        const { data, error } = await supabase
          .from(tableName)
          .select(select)
          .eq('id', parseId(id))
          .single();

        if (error) throw error;
        if (data && typeof data === 'object') {
          setRow(data as Record<string, unknown>);
        } else {
          setRow(null);
        }
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    fetchDetail();
  }, [id, tableName, select]);

  useEffect(() => {
    if (!id || !row || relatedList.length === 0) return;

    const parsedId = parseId(id);

    relatedList.forEach(async (config, index) => {
      setRelatedLoading((prev) => ({ ...prev, [index]: true }));
      try {
        let data: Record<string, unknown>[] = [];

        if (config.query.type === 'direct') {
          const { filterColumn, select: relSelect } = config.query;
          const { data: result } = await supabase
            .from(config.tableName)
            .select(relSelect ?? '*')
            .eq(filterColumn, parsedId);
          data = (result ?? []) as unknown as Record<string, unknown>[];
        } else {
          const {
            junctionTable,
            junctionKey,
            junctionForeignKey,
            select: relSelect,
          } = config.query;

          const { data: junctionRows } = await supabase
            .from(junctionTable)
            .select(`${junctionForeignKey}, order`)
            .eq(junctionKey, parsedId)
            .order('order', { ascending: true });

          const foreignIds = (junctionRows as unknown as Record<string, unknown>[])
            .map((r) => r[junctionForeignKey])
            .filter((v): v is string | number => v != null);

          if (foreignIds.length > 0) {
            const { data: result } = await supabase
              .from(config.tableName)
              .select(relSelect ?? '*')
              .in('id', foreignIds);

            const rows = (result ?? []) as unknown as Record<string, unknown>[];
            const resultMap = new Map(
              rows.map((r) => [r.id as string | number, r])
            );
            data = foreignIds
              .map((fid) => resultMap.get(fid))
              .filter((r): r is Record<string, unknown> => r != null);
          }
        }

        setRelatedData((prev) => ({ ...prev, [index]: data }));
      } finally {
        setRelatedLoading((prev) => ({ ...prev, [index]: false }));
      }
    });
  }, [id, row]); // eslint-disable-line react-hooks/exhaustive-deps

  const summaryKeySet = useMemo(() => {
    if (!row) return new Set<string>();

    const keys = new Set<string>();
    summaryFields.forEach((field) => {
      const resolved = resolveSummaryValue(row, field.key);
      if (resolved) {
        keys.add(resolved.key);
      }
    });

    return keys;
  }, [row, summaryFields]);

  const entries = useMemo(() => {
    if (!row) return [] as Array<[string, unknown]>;
    const visibleEntries = Object.entries(row).filter(
      ([key]) => !hiddenFields.includes(key) && !summaryKeySet.has(key)
    );

    return visibleEntries.sort(([a], [b]) => {
      const aIndex = fieldOrder.indexOf(a);
      const bIndex = fieldOrder.indexOf(b);

      if (aIndex === -1 && bIndex === -1) return a.localeCompare(b, 'ko');
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    });
  }, [row, fieldOrder, hiddenFields, summaryKeySet]);

  const displayRows = useMemo(() => {
    const displayEntries: DisplayEntry[] = entries.map(([key, value]) => {
      const isImage = isImageField(key, value);
      const isAudio = isAudioField(key, value);
      const isBadge = isBadgeField(key);
      const formatted = isBadge
        ? formatBadgeValue(value)
        : formatFieldValue(key, value);

      return {
        key,
        label: fieldLabels[key] ?? key,
        value,
        formatted,
        isImage,
        isAudio,
        isBadge,
        isWide: false,
      };
    });

    const normalizedEntries = displayEntries.map((entry) => ({
      ...entry,
      isWide: isWideField(entry),
    }));

    const rows: DisplayRow[] = [];
    let shortBuffer: DisplayEntry[] = [];

    const flushShortBuffer = () => {
      if (shortBuffer.length === 0) return;
      rows.push({
        mode: shortBuffer.length > 1 ? 'pair' : 'single',
        items: [...shortBuffer],
      });
      shortBuffer = [];
    };

    normalizedEntries.forEach((entry) => {
      if (entry.isWide) {
        flushShortBuffer();
        rows.push({ mode: 'single', items: [entry] });
        return;
      }

      shortBuffer.push(entry);
      if (shortBuffer.length === 2) {
        flushShortBuffer();
      }
    });

    flushShortBuffer();
    return rows;
  }, [entries, fieldLabels]);

  const summaryEntries = useMemo(() => {
    if (!row) return [];

    return summaryFields
      .map((field) => {
        const resolved = resolveSummaryValue(row, field.key);
        if (!resolved) return null;

        return {
          label: field.label,
          key: resolved.key,
          value: resolved.value,
          formatted: formatFieldValue(resolved.key, resolved.value),
          type: field.type ?? 'text',
        };
      })
      .filter(Boolean) as Array<{
      label: string;
      key: string;
      value: unknown;
      formatted: string;
      type: 'text' | 'badge';
    }>;
  }, [row, summaryFields]);

  return (
    <div className='p-10 flex flex-col'>
      <h1 className='mb-4 indent-1' style={{ fontSize: '16px' }}>
        <span className='text-gray-500'>{parentMenu} / </span>
        <span className='font-bold'>{childMenu}</span>
      </h1>

      <div className='w-full rounded-2xl bg-white mt-4 p-8 flex flex-col gap-8 shadow-sm border border-gray-100'>
        <div className='flex items-center justify-between border-b border-gray-100 pb-4'>
          <div>
            <h2 className='text-lg font-semibold'>상세 정보</h2>
            <p className='text-sm text-gray-400 mt-1'>ID: {id}</p>
          </div>
          <div className='flex gap-2'>
            <button
              className='px-3 py-2 rounded bg-gray-100 text-gray-700 hover:bg-gray-200 transition text-sm'
              onClick={() => navigate(listPath)}
            >
              목록
            </button>
            <button
              className='px-3 py-2 rounded bg-blue-100 text-blue-700 hover:bg-blue-200 transition text-sm'
              onClick={() => {
                if (!accessToken) {
                  toast.warn('웹데모 로그인이 필요합니다.');
                  return;
                }
                navigate(`${editPath}/${id}?lang=${lang}`);
              }}
            >
              편집
            </button>
          </div>
        </div>

        <LoadingOverlay loading={loading}>
          상세 정보를 불러오는 중입니다.
        </LoadingOverlay>

        {!loading && error && (
          <div className='py-10 text-center text-red-500'>{error}</div>
        )}

        {!loading && !error && row && (
          <>
            {summaryEntries.length > 0 && (
              <div className='rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3'>
                <div className='flex flex-wrap items-center gap-x-6 gap-y-2 text-sm'>
                  {summaryEntries.map((entry) => (
                    <div
                      key={`${entry.label}-${entry.key}`}
                      className='flex items-center gap-2'
                    >
                      <span className='font-semibold text-gray-700'>
                        {entry.label}:
                      </span>
                      {entry.type === 'badge' ? (
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold border ${getBadgeClassName(
                            entry.formatted
                          )}`}
                        >
                          {entry.formatted}
                        </span>
                      ) : (
                        <span className='text-gray-800'>{entry.formatted}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className='grid grid-cols-1 gap-3'>
              {displayRows.map((rowItem, rowIndex) => {
                if (rowItem.mode === 'pair') {
                  return (
                    <div
                      key={`pair-${rowIndex}`}
                      className='grid grid-cols-1 lg:grid-cols-2 gap-3'
                    >
                      {rowItem.items.map((entry) => (
                        <div
                          key={entry.key}
                          className={`grid ${LABEL_COLUMN_CLASS} rounded-xl border border-gray-100 overflow-hidden min-w-0`}
                        >
                          <div className='px-4 py-3 bg-gray-50 font-semibold text-sm text-gray-600'>
                            {entry.label}
                          </div>
                          <div className='px-4 py-3 text-sm bg-white whitespace-pre-wrap break-words min-w-0'>
                            {entry.isBadge ? (
                              <span
                                className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold border ${getBadgeClassName(
                                  entry.formatted
                                )}`}
                              >
                                {entry.formatted}
                              </span>
                            ) : entry.isImage ? (
                              <ImagePreview url={String(entry.value)} />
                            ) : entry.isAudio ? (
                              <AudioPreview url={String(entry.value)} />
                            ) : (
                              entry.formatted
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                }

                const entry = rowItem.items[0];
                return (
                  <div
                    key={`single-${entry.key}-${rowIndex}`}
                    className={`grid ${LABEL_COLUMN_CLASS} rounded-xl border border-gray-100 overflow-hidden min-w-0`}
                  >
                    <div className='px-4 py-4 bg-gray-50 font-semibold text-sm text-gray-600'>
                      {entry.label}
                    </div>
                    <div className='px-4 py-4 text-sm whitespace-pre-wrap break-words bg-white min-w-0'>
                      {entry.isBadge ? (
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold border ${getBadgeClassName(
                            entry.formatted
                          )}`}
                        >
                          {entry.formatted}
                        </span>
                      ) : entry.isImage ? (
                        <ImagePreview url={String(entry.value)} />
                      ) : entry.isAudio ? (
                        <AudioPreview url={String(entry.value)} />
                      ) : (
                        entry.formatted
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {relatedList.map((config, index) => {
        const selectedRelatedLang = relatedLang[index] ?? 'all';
        const allData = relatedData[index] ?? [];
        const filteredData =
          config.enableLangFilter && selectedRelatedLang !== 'all'
            ? allData.filter((r) => {
                const language = r.language;
                if (Array.isArray(language))
                  return language.includes(selectedRelatedLang);
                return language === selectedRelatedLang;
              })
            : allData;

        return (
          <div
            key={config.title}
            className='w-full rounded-2xl bg-white mt-4 p-8 flex flex-col gap-6 shadow-sm border border-gray-100'
          >
            <div className='flex items-center justify-between border-b border-gray-100 pb-4'>
              <div>
                <h2 className='text-lg font-semibold'>{config.title}</h2>
                {!relatedLoading[index] && (
                  <p className='text-sm text-gray-400 mt-1'>
                    총 {filteredData.length}개
                  </p>
                )}
              </div>
              {config.enableLangFilter && (
                <div className='flex items-center gap-2'>
                  <span className='text-sm text-gray-600 font-medium'>
                    국가:
                  </span>
                  <Dropdown
                    value={selectedRelatedLang}
                    options={[...LANGUAGES]}
                    onChange={(v) =>
                      setRelatedLang((prev) => ({ ...prev, [index]: v }))
                    }
                  />
                </div>
              )}
            </div>

            <LoadingOverlay loading={relatedLoading[index] ?? false}>
              불러오는 중입니다.
            </LoadingOverlay>

            {!(relatedLoading[index] ?? false) && (
              <DemoTableList
                data={filteredData}
                selectedLang={selectedRelatedLang}
                tableName={config.tableName}
                detailPath={config.detailPath}
                editPath={config.editPath}
                columns={config.columns}
                gridCols={config.gridCols}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};

export default DemoEntityDetail;
