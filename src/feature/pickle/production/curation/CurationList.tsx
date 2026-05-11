import { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { usingCurationExcelProps } from '../../../../types/type';
import formatDateString from '../../../../utils/format/formatDateString';

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

const CurationList = ({ data }: { data: usingCurationExcelProps[] }) => {
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
      key: 'curationType',
      label: '큐레이션 타입',
      width: '120px',
      noDataWidth: '120px',
      className: 'px-2 truncate flex-shrink-0',
    },
    {
      key: 'usageYn',
      label: '사용 여부',
      width: '80px',
      noDataWidth: '80px',
      className: 'px-2 truncate flex-shrink-0',
    },
    {
      key: 'curationName',
      label: '큐레이션명',
      width: '200px',
      noDataWidth: '200px',
      className: 'px-2 line-clamp-2 break-words flex-shrink-0',
    },
    {
      key: 'curationDesc',
      label: '큐레이션 설명',
      width: '200px',
      noDataWidth: '200px',
      className: 'px-2 line-clamp-2 break-words flex-shrink-0',
    },
    {
      key: 'dispPeriod',
      label: '게시 기간',
      width: '320px',
      noDataWidth: '200px',
      className: 'px-2 text-sm truncate flex-shrink-0',
      render: (curation: usingCurationExcelProps) =>
        `${formatDateString(curation.dispStartDtime)} ~ ${formatDateString(curation.dispEndDtime)}`,
    },
    {
      key: 'curationCreatedAt',
      label: '등록일',
      width: '180px',
      noDataWidth: '120px',
      className: 'px-2 truncate flex-shrink-0',
      render: (curation: usingCurationExcelProps) =>
        formatDateString(curation.curationCreatedAt),
    },
    {
      key: 'channelName',
      label: '채널명',
      width: '180px',
      noDataWidth: '120px',
      className: 'px-2 line-clamp-2 break-words flex-shrink-0',
    },
    {
      key: 'episodeName',
      label: '에피소드명',
      width: '320px',
      noDataWidth: '120px',
      className: 'px-2 line-clamp-2 break-words flex-shrink-0',
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
                const curation = data[virtualRow.index];
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
                        ? column.render(curation)
                        : String(
                            curation[
                              column.key as keyof usingCurationExcelProps
                            ] || ''
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
              새로 등록된 큐레이션이 존재하지 않습니다.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CurationList;
