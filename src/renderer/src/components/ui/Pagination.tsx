import { ChevronLeft, ChevronRight } from 'lucide-react';
import { clampPage, pageCount, pageItems } from '../../lib/pagination';
import { Button } from './Button';
export function Pagination({ page: requested, pageSize, total, onPage, onPageSize, label = 'Results', disabled = false }: {
  page: number; pageSize: number; total: number; onPage: (page: number) => void;
  onPageSize?: (size: number) => void; label?: string; disabled?: boolean;
}) {
  const pages = pageCount(total, pageSize);
  const page = clampPage(requested, total, pageSize);
  return <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 text-xs text-secondary">
    <p role="status" aria-live="polite" className="tabular-nums">{total ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)}` : '0'} of {total} <span className="lowercase">{label}</span></p>
    <div className="flex flex-wrap items-center gap-3">
      {onPageSize && <label className="flex items-center gap-2">Rows per page<select aria-label={`${label} per page`} value={pageSize} disabled={disabled} onChange={e => onPageSize(Number(e.target.value))} className="rounded-md border border-line bg-surface px-2 py-1.5 text-ink">{[...new Set([10, 25, 50, 100, pageSize])].sort((a,b)=>a-b).map(n => <option key={n} value={n}>{n}</option>)}</select></label>}
      {pages > 1 && <nav aria-label={`${label} pagination`} className="flex items-center gap-1">
        <Button variant="ghost" size="icon" aria-label={`Previous ${label.toLowerCase()} page`} disabled={disabled || page <= 1} onClick={() => onPage(page - 1)}><ChevronLeft className="h-4 w-4" /></Button>
        {pageItems(page, pages).map((n, i) => n === 'gap' ? <span key={`gap-${i}`} className="px-1" aria-hidden="true">…</span> : <button key={n} type="button" aria-label={`${label} page ${n}`} aria-current={n === page ? 'page' : undefined} disabled={disabled} onClick={() => onPage(n)} className={`h-8 min-w-8 rounded-md px-2 font-semibold disabled:opacity-50 ${n === page ? 'bg-primary text-on-primary' : 'text-secondary hover:bg-subtle'}`}>{n}</button>)}
        <Button variant="ghost" size="icon" aria-label={`Next ${label.toLowerCase()} page`} disabled={disabled || page >= pages} onClick={() => onPage(page + 1)}><ChevronRight className="h-4 w-4" /></Button>
      </nav>}
    </div>
  </div>;
}
