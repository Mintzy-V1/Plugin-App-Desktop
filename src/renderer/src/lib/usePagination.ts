import { useEffect, useState } from 'react';
import { clampPage, pageCount } from './pagination';
export function usePagination<T>(rows: readonly T[], initialSize = 25, resetKey = '') {
  const [requestedPage, setPage] = useState(1);
  const [pageSize, setSize] = useState(initialSize);
  const page = clampPage(requestedPage, rows.length, pageSize);
  useEffect(() => { setPage(1); }, [resetKey]);
  useEffect(() => { if (requestedPage !== page) setPage(page); }, [page, requestedPage]);
  return {
    page, pageSize, total: rows.length, pages: pageCount(rows.length, pageSize),
    rows: rows.slice((page - 1) * pageSize, page * pageSize),
    onPage: setPage,
    onPageSize: (size: number) => { setSize(Math.max(1, size)); setPage(1); },
  };
}
