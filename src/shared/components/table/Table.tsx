import React from 'react';

export interface Column {
  key: string;
  label: string;
}

interface TableProps<T> {
  columns: Column[];
  data: T[];
  gridTemplateColumns: string;
  renderCell: (columnKey: string, row: T) => React.ReactNode;
  onRowClick?: (row: T) => void;
  emptyText?: string;
}

function Table<T>({
  columns,
  data,
  gridTemplateColumns,
  renderCell,
  onRowClick,
  emptyText = '데이터가 없습니다.',
}: TableProps<T>) {
  return (
    <div className='w-full flex flex-col'>
      {/* 헤더 */}
      <div
        className='grid font-bold bg-white border-b-2 border-gray-300 sticky top-0 z-10'
        style={{ gridTemplateColumns }}
      >
        {columns.map((col) => (
          <div key={col.key} className='px-2 py-3 truncate'>
            {col.label}
          </div>
        ))}
      </div>

      {/* 바디 */}
      <div className='flex flex-col'>
        {data.length > 0 ? (
          data.map((row: T, rowIndex) => (
            <div
              key={(row as any).id ?? rowIndex}
              className={`grid border-b border-gray-200 items-center hover:bg-gray-50 transition ${
                onRowClick ? 'cursor-pointer' : ''
              }`}
              style={{ gridTemplateColumns }}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {columns.map((col) => (
                <div
                  key={col.key}
                  className='px-2 py-2 flex items-center overflow-hidden'
                >
                  <div className='truncate w-full'>
                    {renderCell(col.key, row)}
                  </div>
                </div>
              ))}
            </div>
          ))
        ) : (
          <div className='py-10 text-center text-gray-400'>{emptyText}</div>
        )}
      </div>
    </div>
  );
}

export default Table;
