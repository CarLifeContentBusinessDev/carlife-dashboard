import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import type { usingDataProps } from '../../types/type';
import formatDateString from '../../utils/format/formatDateString';
import { formatPlayTime } from '../../utils/format/formatPlayTime';
import { normalizeUsageYn } from '../../utils/format/normalizeUsageYn';

const COLUMNS = [
  { key: 'episodeId', label: '에피소드 ID', width: '110px' },
  { key: 'usageYn', label: '활성 상태', width: '70px' },
  { key: 'channelName', label: '채널명', width: '160px' },
  { key: 'episodeName', label: '에피소드명', width: '360px' },
  { key: 'dispDtime', label: '게시일자', width: '160px' },
  { key: 'createdAt', label: '등록일자', width: '160px' },
  { key: 'playTime', label: '에피소드 시간', width: '130px' },
  { key: 'likeCnt', label: '좋아요수', width: '80px' },
  { key: 'listenCnt', label: '청취수', width: '70px' },
  { key: 'thumbnailUrl', label: 'thumbnail_url', width: '160px' },
  { key: 'audioUrl', label: 'audio_url', width: '160px' },
  { key: 'channelId', label: 'channelId', width: '80px' },
  { key: 'category', label: '카테고리', width: '100px' },
  { key: 'note', label: '비고', width: '100px' },
];

const getCellContent = (ep: usingDataProps, key: string): React.ReactNode => {
  switch (key) {
    case 'usageYn': {
      const usageYn = normalizeUsageYn(ep.usageYn);
      return (
        <span
          className={`px-2 py-0.5 rounded text-xs font-bold ${
            usageYn === 'Y'
              ? 'bg-green-100 text-green-700'
              : 'bg-red-100 text-red-700'
          }`}
        >
          {usageYn || '-'}
        </span>
      );
    }
    case 'dispDtime':
      return formatDateString(ep.dispDtime);
    case 'createdAt':
      return formatDateString(ep.createdAt);
    case 'playTime':
      return formatPlayTime(ep.playTime);
    case 'category':
    case 'note':
      return '';
    default:
      return (
        ((ep as unknown as Record<string, unknown>)[key] as React.ReactNode) ??
        ''
      );
  }
};

interface ProdEpisodeListProps {
  data: usingDataProps[];
  isStaging?: boolean;
}

const ProdEpisodeList: React.FC<ProdEpisodeListProps> = ({
  data,
  isStaging,
}) => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleRowClick = (ep: usingDataProps) => {
    const basePath = isStaging ? '/stg/episode/detail' : '/episode/detail';
    navigate(`${basePath}/${ep.episodeId}`, {
      state: { episode: ep, from: location.pathname },
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
        data.map((ep) => (
          <div
            key={ep.episodeId}
            onClick={() => handleRowClick(ep)}
            className='flex items-center border-b border-gray-200 hover:bg-gray-50 transition py-3 cursor-pointer'
          >
            {COLUMNS.map((col) => (
              <div
                key={col.key}
                className='px-2 flex-shrink-0 text-sm truncate'
                style={{ width: col.width }}
              >
                {getCellContent(ep, col.key)}
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  );
};

export default ProdEpisodeList;
