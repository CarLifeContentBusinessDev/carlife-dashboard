import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  BLUE_BADGE_STYLE,
  GRAY_BADGE_STYLE,
  GREEN_BADGE_STYLE,
  ORANGE_BADGE_STYLE,
  PURPLE_BADGE_STYLE,
  RED_BADGE_STYLE,
  YELLOW_BADGE_STYLE,
} from '@/constants/badgeStyles';
import type { ProdFastRow } from '@/shared/types/pickleProdContents';
import formatDateString from '@/shared/utils/format/formatDateString';
import { formatPlayTime } from '@/shared/utils/format/formatPlayTime';
import { mapFastHlsStatus } from '@/shared/utils/format/statusMapper';
import { normalizeUsageYn } from '@/shared/utils/format/normalizeUsageYn';

const getHlsStatusBadgeClass = (status: string): string => {
  switch (status.toUpperCase()) {
    case 'COMPLETED':
      return BLUE_BADGE_STYLE;
    case 'IN_PROGRESS':
      return YELLOW_BADGE_STYLE;
    case 'QUEUED':
      return PURPLE_BADGE_STYLE;
    case 'CANCELED':
      return ORANGE_BADGE_STYLE;
    default:
      return GRAY_BADGE_STYLE;
  }
};

const COLUMNS = [
  { key: 'fastId', label: '채널 ID', width: '90px' },
  { key: 'usageYn', label: '활성화', width: '80px' },
  { key: 'fastName', label: 'FAST 명', width: '200px' },
  { key: 'includedChannelNames', label: '포함 채널명', width: '220px' },
  { key: 'hlsStatus', label: '생성 상태', width: '120px' },
  { key: 'episodeCount', label: '에피소드 수', width: '90px' },
  { key: 'createdAt', label: '등록 일시', width: '160px' },
  { key: 'dispPeriod', label: '게시기간', width: '200px' },
  { key: 'generationStartedAt', label: '생성 시작 시간', width: '160px' },
  { key: 'generationEndedAt', label: '생성 종료 시간', width: '160px' },
  { key: 'totalGenerationSeconds', label: '총 생성 시간', width: '140px' },
  { key: 'touchCount', label: '터치 수', width: '90px' },
  { key: 'playRequestCount', label: '재생 요청 수', width: '100px' },
  { key: 'streamUrl', label: 'streamUrl', width: '220px' },
  { key: 'thumbnailUrl', label: 'thumbnail_url', width: '220px' },
] as const;

const getCellContent = (
  row: ProdFastRow,
  key: (typeof COLUMNS)[number]['key']
): React.ReactNode => {
  switch (key) {
    case 'usageYn': {
      const usage = normalizeUsageYn(row.usageYn);
      return (
        <span
          className={`px-2 py-0.5 rounded text-xs font-bold ${
            usage === 'Y' ? GREEN_BADGE_STYLE : RED_BADGE_STYLE
          }`}
        >
          {usage || '-'}
        </span>
      );
    }
    case 'hlsStatus': {
      const status = String(row.hlsStatus ?? '');
      return (
        <span
          className={`px-2 py-0.5 rounded text-xs font-bold ${getHlsStatusBadgeClass(status)}`}
        >
          {status ? mapFastHlsStatus(status) : '-'}
        </span>
      );
    }
    case 'createdAt':
    case 'generationStartedAt':
    case 'generationEndedAt':
      return formatDateString(String(row[key] ?? '')) || '-';
    case 'dispPeriod': {
      const toDate = (value: string) => formatDateString(value).slice(0, 10);
      return `${toDate(row.dispStartDtime)} ~ ${toDate(row.dispEndDtime)}`;
    }
    case 'totalGenerationSeconds':
      return row.totalGenerationSeconds > 0
        ? formatPlayTime(row.totalGenerationSeconds)
        : '-';
    case 'touchCount':
      return row.touchCount > 0 ? row.touchCount : '0';
    case 'thumbnailUrl':
      return '-';
    default:
      return String(row[key as keyof ProdFastRow] ?? '');
  }
};

interface ProdFastListProps {
  data: ProdFastRow[];
  isStaging?: boolean;
}

const ProdFastList: React.FC<ProdFastListProps> = ({ data, isStaging }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleRowClick = (row: ProdFastRow) => {
    const basePath = isStaging
      ? '/pickle/stg/fast/detail'
      : '/pickle/fast/detail';

    navigate(`${basePath}/${row.fastId}`, {
      state: { fast: row, from: location.pathname },
    });
  };

  return (
    <div style={{ minWidth: 'max-content', width: '100%' }}>
      <div className='flex font-bold py-3 bg-white border-b-2 border-gray-300 sticky top-0 z-10'>
        {COLUMNS.map((col) => (
          <p
            key={col.key}
            className='px-2 shrink-0 text-sm'
            style={{ width: col.width }}
          >
            {col.label}
          </p>
        ))}
      </div>

      {data.length === 0 ? (
        <div className='flex items-center justify-center py-10 text-gray-400'>
          데이터가 없습니다.
        </div>
      ) : (
        data.map((row) => (
          <div
            key={row.fastId}
            onClick={() => handleRowClick(row)}
            className='flex items-center border-b border-gray-200 hover:bg-gray-50 transition py-3 cursor-pointer'
          >
            {COLUMNS.map((col) => (
              <div
                key={col.key}
                className='px-2 shrink-0 text-sm truncate'
                style={{ width: col.width }}
              >
                {getCellContent(row, col.key)}
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  );
};

export default ProdFastList;
