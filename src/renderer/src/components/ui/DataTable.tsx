import type { Key, ReactNode } from 'react';
import { EmptyState, Spinner } from './Feedback';
export interface Column<T> { id: string; header: ReactNode; cell: (row: T) => ReactNode; align?: 'left' | 'right'; }
export function DataTable<T>({ columns, rows, rowKey, isProblem, loading, emptyTitle = 'No records', emptyDescription, caption, minWidth }: {
  columns: Column<T>[]; rows: T[]; rowKey: (row: T) => Key; isProblem?: (row: T) => boolean;
  loading?: boolean; emptyTitle?: string; emptyDescription?: string; caption: string; minWidth?: number;
}) {
  return <div className="max-h-[65vh] overflow-auto rounded-xl border border-line bg-surface">
    <table aria-busy={loading || undefined} style={{ minWidth }} className="w-full border-collapse text-left text-[13px] tabular-nums">
      <caption className="sr-only">{caption}</caption>
      <thead className="sticky top-0 z-10 bg-subtle text-[11px] uppercase tracking-wider text-muted"><tr>{columns.map(column => <th key={column.id} scope="col" className={`border-b border-line px-4 py-3 font-semibold ${column.align === 'right' ? 'text-right' : ''}`}>{column.header}</th>)}</tr></thead>
      <tbody className="divide-y divide-line text-secondary">{!loading && rows.map(row => <tr key={rowKey(row)} className={isProblem?.(row) ? 'bg-problem' : 'hover:bg-subtle'}>{columns.map(column => <td key={column.id} className={`px-4 py-3 ${column.align === 'right' ? 'text-right' : ''}`}>{column.cell(row)}</td>)}</tr>)}
        {(loading || rows.length === 0) && <tr><td colSpan={columns.length}>{loading ? <Spinner /> : <EmptyState title={emptyTitle} description={emptyDescription} />}</td></tr>}
      </tbody>
    </table>
  </div>;
}
