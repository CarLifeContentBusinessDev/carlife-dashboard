import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';
import type { usingChannelProps } from '@/shared/types/pickleProdContents';
import formatDateString from '@/shared/utils/format/formatDateString';

interface HeaderColumnProps {
  label: string;
  width: string;
}

const HeaderColumn = ({ label, width }: HeaderColumnProps) => {
  return (
    <p className='px-2 flex-shrink-0' style={{ width: width }}>
      {label}
    </p>
  );
};

interface ContentColumnProps {
  className: string;
  value: string | number;
  width: string;
}

const ContentColumn = ({ className, value, width }: ContentColumnProps) => {
  return (
    <p className={className} style={{ width: width }}>
      {value}
    </p>
  );
};

const ChannelList = ({ data }: { data: usingChannelProps[] }) => {
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 60,
    overscan: 10,
  });

  const hasData = data.length > 0;

  const columns = [
    {
      key: 'channelId',
      label: '채널ID',
      width: '120px',
      noDataWidth: '120px',
      className: 'px-3 truncate flex-shrink-0',
    },
    {
      key: 'interfaceUrl',
      label: 'interface_url',
      width: '400px',
      noDataWidth: '400px',
      className: 'px-2 line-clamp-2 break-words flex-shrink-0',
    },
    {
      key: 'channelTypeName',
      label: '채널 타입',
      width: '100px',
      noDataWidth: '100px',
      className: 'px-2 truncate flex-shrink-0',
    },
    {
      key: 'interfaceType',
      label: 'interface_type',
      width: '140px',
      noDataWidth: '140px',
      className: 'px-2 truncate flex-shrink-0',
    },
    {
      key: 'channelName',
      label: '채널명',
      width: '280px',
      noDataWidth: '280px',
      className: 'px-2 line-clamp-2 break-words flex-shrink-0',
    },
    {
      key: 'categoryId',
      label: '카테고리ID',
      width: '100px',
      noDataWidth: '100px',
      className: 'px-3 truncate flex-shrink-0',
    },
    {
      key: 'createdAt',
      label: '등록일',
      width: '180px',
      noDataWidth: '120px',
      className: 'px-2 truncate flex-shrink-0',
      render: (channel: usingChannelProps) =>
        formatDateString(channel.createdAt),
    },
    {
      key: 'dispDtime',
      label: '최근 에피소드 업로드일',
      width: '180px',
      noDataWidth: '180px',
      className: 'px-2 truncate flex-shrink-0',
      render: (channel: usingChannelProps) =>
        formatDateString(channel.dispDtime),
    },
  ];

  return (
    <div
      className={`w-full flex flex-col min-h-0 ${hasData ? 'flex-[2]' : 'flex-[1]'}`}
    >
      <div ref={parentRef} className='w-full flex-1 overflow-auto'>
        <div style={{ minWidth: hasData ? 'max-content' : 'auto' }}>
          {/* 고정 헤더 */}
          <div className='flex font-bold py-4 bg-white border-b-2 border-gray-300 sticky top-0 z-10'>
            {columns.map((column) => (
              <HeaderColumn
                key={column.key}
                label={column.label}
                width={hasData ? column.width : column.noDataWidth}
              />
            ))}
          </div>

          {/* 데이터 리스트 */}
          {hasData ? (
            <div
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                position: 'relative',
              }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const channel = data[virtualRow.index];
                return (
                  <div
                    key={virtualRow.key}
                    data-index={virtualRow.index}
                    ref={rowVirtualizer.measureElement}
                    className='absolute left-0 right-0 flex items-center border-b border-gray-200 cursor-pointer hover:bg-gray-100 transition'
                    style={{
                      transform: `translateY(${virtualRow.start}px)`,
                      height: `${virtualRow.size}px`,
                    }}
                  >
                    {columns.map((column) => {
                      const value = column.render
                        ? column.render(channel)
                        : String(
                            channel[column.key as keyof usingChannelProps] || ''
                          );

                      return (
                        <ContentColumn
                          key={column.key}
                          className={column.className}
                          value={value}
                          width={column.width}
                        />
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className='w-full flex items-center justify-center pt-10'>
              새로 등록된 채널·도서가 존재하지 않습니다.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChannelList;
