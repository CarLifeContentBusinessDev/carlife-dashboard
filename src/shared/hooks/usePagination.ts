import { useState, useMemo, useEffect } from 'react';

export default function usePagination<T>(data: T[], pageSize = 10) {
  const [page, setPage] = useState(1);

  const totalPages = Math.ceil(data.length / pageSize);

  // 데이터가 변경되어 현재 페이지가 범위를 벗어나면 1페이지로 이동
  useEffect(() => {
    if (page > totalPages && totalPages > 0) {
      setPage(1);
    }
  }, [totalPages, page]);

  const pagedData = useMemo(() => {
    return data.slice((page - 1) * pageSize, page * pageSize);
  }, [data, page, pageSize]);

  return {
    page,
    setPage,
    totalPages,
    pagedData,
  };
}
