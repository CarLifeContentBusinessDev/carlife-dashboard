import React from 'react';
import {
  FiChevronDown,
  FiChevronLeft,
  FiChevronRight,
  FiChevronsLeft,
  FiChevronsRight,
} from 'react-icons/fi';

const PAGE_SIZE_OPTIONS = [
  { value: 10, label: '10 / page' },
  { value: 20, label: '20 / page' },
  { value: 50, label: '50 / page' },
  { value: 100, label: '100 / page' },
  { value: 0, label: '전체' },
];

interface PaginationProps {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
  pageSize?: number;
  onPageSizeChange?: (size: number) => void;
}

const Pagination: React.FC<PaginationProps> = ({
  page,
  totalPages,
  onChange,
  pageSize,
  onPageSizeChange,
}) => {
  if (totalPages <= 1 && !onPageSizeChange) return null;

  const startPage = Math.max(page - 2, 1);
  const endPage = Math.min(startPage + 4, totalPages);

  const pages = [];
  for (let i = startPage; i <= endPage; i++) {
    pages.push(i);
  }

  const showPageNav = totalPages >= 1;

  return (
    <div className='flex justify-center items-center gap-2 mt-6 flex-wrap'>
      {showPageNav && (
        <>
          {/* 맨 처음 */}
          <button
            disabled={page === 1}
            onClick={() => onChange(1)}
            className='flex items-center justify-center w-8 h-8 rounded-md hover:bg-gray-100 disabled:opacity-40 cursor-pointer'
            title='맨 처음'
          >
            <FiChevronsLeft size={18} />
          </button>

          {/* 이전 */}
          <button
            disabled={page === 1}
            onClick={() => onChange(page - 1)}
            className='flex items-center justify-center w-8 h-8 rounded-md hover:bg-gray-100 disabled:opacity-40 cursor-pointer'
            title='이전'
          >
            <FiChevronLeft size={18} />
          </button>

          {/* 페이지 번호 */}
          {pages.map((p) => (
            <button
              key={p}
              onClick={() => onChange(p)}
              className={`w-8 h-8 rounded-md text-sm font-medium transition cursor-pointer
          ${page === p ? 'bg-blue-500 text-white' : 'hover:bg-gray-100'}`}
            >
              {p}
            </button>
          ))}

          {/* 다음 */}
          <button
            disabled={page === totalPages}
            onClick={() => onChange(page + 1)}
            className='flex items-center justify-center w-8 h-8 rounded-md hover:bg-gray-100 disabled:opacity-40 cursor-pointer'
            title='다음'
          >
            <FiChevronRight size={18} />
          </button>

          {/* 맨 끝 */}
          <button
            disabled={page === totalPages}
            onClick={() => onChange(totalPages)}
            className='flex items-center justify-center w-8 h-8 rounded-md hover:bg-gray-100 disabled:opacity-40 cursor-pointer'
            title='맨 끝'
          >
            <FiChevronsRight size={18} />
          </button>
        </>
      )}

      {onPageSizeChange && showPageNav && (
        <div className='relative ml-4'>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className='h-8 appearance-none rounded-md border border-gray-300 bg-white pl-3 pr-7 text-sm text-gray-700 cursor-pointer hover:border-gray-400 focus:outline-none'
          >
            {PAGE_SIZE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <div className='pointer-events-none absolute inset-y-0 right-2 flex items-center'>
            <FiChevronDown size={13} className='text-gray-500' />
          </div>
        </div>
      )}
    </div>
  );
};

export default Pagination;
