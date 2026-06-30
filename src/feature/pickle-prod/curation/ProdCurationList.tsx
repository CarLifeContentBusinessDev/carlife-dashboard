import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type {
  ProdCurationRow,
  usingCurationExcelProps,
} from '@/shared/types/pickleProdContents';
import formatDateString from '@/shared/utils/format/formatDateString';
import { normalizeUsageYn } from '@/shared/utils/format/normalizeUsageYn';
import {
  BLUE_BADGE_STYLE,
  GREEN_BADGE_STYLE,
  ORANGE_BADGE_STYLE,
  RED_BADGE_STYLE,
  PURPLE_BADGE_STYLE,
  YELLOW_BADGE_STYLE,
  GRAY_BADGE_STYLE,
} from '@/constants/badgeStyles';

const getExhibitionBadgeClass = (value: string): string => {
  switch (value) {
    case '게시 종료':
      return ORANGE_BADGE_STYLE;
    case '게시 대기':
      return PURPLE_BADGE_STYLE;
    case '게시 중':
      return BLUE_BADGE_STYLE;
    case '게시 예약':
      return YELLOW_BADGE_STYLE;
    default:
      return GRAY_BADGE_STYLE;
  }
};

const COLUMNS = [
  { key: 'thumbnailUrlSquare', label: '썸네일', width: '80px' },
  { key: 'curationType', label: '타입', width: '100px' },
  { key: 'curationName', label: '큐레이션명', width: '240px' },
  { key: 'curationDesc', label: '큐레이션 설명', width: '220px' },
  { key: 'activeState', label: '활성 상태', width: '100px' },
  { key: 'exhibitionState', label: '전시 상태', width: '100px' },
  { key: 'field', label: '영역', width: '100px' },
  { key: 'section', label: '상세위치', width: '90px' },
  { key: 'dispStartDtime', label: '게시 시작일', width: '160px' },
  { key: 'dispEndDtime', label: '게시 종료일', width: '160px' },
  { key: 'curationCreatedAt', label: '등록일시', width: '160px' },
  { key: 'channelId', label: '채널 ID', width: '90px' },
  { key: 'episodeId', label: '에피소드 ID', width: '100px' },
  { key: 'usageYn', label: '상태', width: '90px' },
  { key: 'channelName', label: '채널명', width: '170px' },
  { key: 'episodeName', label: '에피소드명', width: '240px' },
  { key: 'dispDtime', label: '게시일자', width: '160px' },
  { key: 'createdAt', label: '등록일자', width: '160px' },
  { key: 'playTime', label: '에피소드 시간', width: '120px' },
  { key: 'likeCnt', label: '좋아요수', width: '90px' },
  { key: 'listenCnt', label: '청취수', width: '90px' },
  { key: 'uploader', label: '게시자', width: '120px' },
] as const;

const getCellContent = (
  row: ProdCurationRow,
  key: (typeof COLUMNS)[number]['key']
): React.ReactNode => {
  switch (key) {
    case 'thumbnailUrlSquare': {
      const url = row.thumbnailUrlSquare || row.thumbnailUrlRect;
      if (!url) return <span className='text-gray-300 text-xs'>-</span>;
      return (
        <img
          src={url}
          alt='thumbnail'
          className='w-12 h-12 rounded object-cover bg-gray-100'
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      );
    }
    case 'activeState': {
      const usage = normalizeUsageYn(row.activeState);
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
    case 'exhibitionState': {
      const exhibition = String(row.exhibitionState ?? '');
      return (
        <span
          className={`px-2 py-0.5 rounded text-xs font-bold ${getExhibitionBadgeClass(exhibition)}`}
        >
          {exhibition || '-'}
        </span>
      );
    }
    case 'dispStartDtime':
    case 'dispEndDtime':
    case 'curationCreatedAt':
    case 'dispDtime':
    case 'createdAt':
      return formatDateString(String(row[key] ?? ''));
    default:
      return String(row[key as keyof usingCurationExcelProps] ?? '');
  }
};

interface ProdCurationListProps {
  data: ProdCurationRow[];
  scrollRef?: React.RefObject<HTMLDivElement | null>;
  isStaging?: boolean;
}

const ProdCurationList: React.FC<ProdCurationListProps> = ({
  data,
  isStaging,
}) => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleRowClick = (row: ProdCurationRow) => {
    const basePath = isStaging ? '/stg/curations/detail' : '/curations/detail';

    navigate(`${basePath}/${row.curationId}`, {
      state: { curation: row, from: location.pathname },
    });
  };

  return (
    <div style={{ minWidth: 'max-content', width: '100%' }}>
      <div className='flex font-bold py-3 bg-white border-b-2 border-gray-300 sticky top-0 z-10'>
        {COLUMNS.map((col) => (
          <p
            key={col.key}
            className='px-2 flex-shrink-0 text-sm'
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
            key={row.curationId}
            onClick={() => handleRowClick(row)}
            className='flex items-center border-b border-gray-200 hover:bg-gray-50 transition py-3 cursor-pointer'
          >
            {COLUMNS.map((col) => (
              <div
                key={col.key}
                className={`px-2 flex-shrink-0 text-sm ${col.key === 'thumbnailUrlSquare' ? '' : 'truncate'}`}
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

export default ProdCurationList;
