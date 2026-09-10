import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { usingChannelProps } from '@/shared/types/pickleProdContents';
import formatDateString from '@/shared/utils/format/formatDateString';
import { normalizeUsageYn } from '@/shared/utils/format/normalizeUsageYn';
import { GREEN_BADGE_STYLE, RED_BADGE_STYLE } from '@/constants/badgeStyles';

const COLUMNS = [
  { key: 'channelId', label: '채널 ID', width: '90px' },
  { key: 'usageYn', label: '활성 상태', width: '80px' },
  { key: 'channelName', label: '채널명', width: '200px' },
  { key: 'vendorName', label: '제작사명', width: '140px' },
  { key: 'categoryName', label: '카테고리', width: '220px' },
  { key: 'episodeCount', label: '에피소드 수', width: '110px' },
  { key: 'dispDtime', label: '최근 에피소드 업로드일', width: '180px' },
  { key: 'channelTypeName', label: '채널 타입', width: '110px' },
  { key: 'likeCnt', label: '좋아요수', width: '90px' },
  { key: 'listenCnt', label: '재생 요청 수', width: '110px' },
  { key: 'createdAt', label: '등록일', width: '170px' },
  { key: 'interfaceUrl', label: 'RSS URL', width: '240px' },
  { key: 'thumbnailUrl', label: 'thumbnail URL', width: '240px' },
] as const;

const getEpisodeCount = (channel: usingChannelProps): string | number => {
  const raw = channel as unknown as Record<string, unknown>;

  const count =
    raw.episodeCount ??
    raw.episodeCnt ??
    raw.totalEpisodeCount ??
    raw.contentsCount;

  return (count as string | number | undefined) ?? '-';
};

const getCellContent = (
  channel: usingChannelProps,
  key: (typeof COLUMNS)[number]['key'],
  episodeCountByChannelId: Record<number, number>,
  latestEpisodeUploadByChannelId: Record<number, string>
): React.ReactNode => {
  switch (key) {
    case 'categoryName': {
      const cats = channel.categoryList ?? [];
      if (cats.length === 0) return channel.categoryName || '-';
      return (
        <div className='flex flex-wrap gap-1'>
          {cats.map((c) => (
            <span
              key={c.categoryId}
              className='px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 text-xs whitespace-nowrap'
            >
              {c.categoryName}
            </span>
          ))}
        </div>
      );
    }
    case 'usageYn': {
      const usageYn = normalizeUsageYn(channel.usageYn);
      return (
        <span
          className={`px-2 py-0.5 rounded text-xs font-bold ${
            usageYn === 'Y' ? GREEN_BADGE_STYLE : RED_BADGE_STYLE
          }`}
        >
          {usageYn || '-'}
        </span>
      );
    }
    case 'dispDtime':
      return formatDateString(
        latestEpisodeUploadByChannelId[channel.channelId] ?? channel.dispDtime
      );
    case 'createdAt':
      return formatDateString(channel.createdAt);
    case 'episodeCount': {
      if (episodeCountByChannelId[channel.channelId] !== undefined) {
        return episodeCountByChannelId[channel.channelId];
      }
      return getEpisodeCount(channel);
    }
    default:
      return (
        ((channel as unknown as Record<string, unknown>)[
          key
        ] as React.ReactNode) ?? ''
      );
  }
};

interface ProdChannelListProps {
  data: usingChannelProps[];
  scrollRef?: React.RefObject<HTMLDivElement | null>;
  episodeCountByChannelId?: Record<number, number>;
  latestEpisodeUploadByChannelId?: Record<number, string>;
  isStaging?: boolean;
}

const ProdChannelList: React.FC<ProdChannelListProps> = ({
  data,
  episodeCountByChannelId = {},
  latestEpisodeUploadByChannelId = {},
  isStaging,
}) => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleRowClick = (channel: usingChannelProps) => {
    const basePath = isStaging
      ? '/pickle/stg/channels/detail'
      : '/pickle/channels/detail';
    const latestDispDtime =
      latestEpisodeUploadByChannelId[channel.channelId] ?? channel.dispDtime;

    navigate(`${basePath}/${channel.channelId}`, {
      state: {
        channel: {
          ...channel,
          dispDtime: latestDispDtime,
        },
        from: location.pathname,
      },
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
        data.map((channel) => (
          <div
            key={channel.channelId}
            onClick={() => handleRowClick(channel)}
            className='flex items-center border-b border-gray-200 hover:bg-gray-50 transition py-3 cursor-pointer'
          >
            {COLUMNS.map((col) => (
              <div
                key={col.key}
                className={`px-2 shrink-0 text-sm ${
                  col.key === 'categoryName' ? '' : 'truncate'
                }`}
                style={{ width: col.width }}
              >
                {getCellContent(
                  channel,
                  col.key,
                  episodeCountByChannelId,
                  latestEpisodeUploadByChannelId
                )}
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  );
};

export default ProdChannelList;
