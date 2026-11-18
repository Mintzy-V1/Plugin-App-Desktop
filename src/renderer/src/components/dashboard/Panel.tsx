import { useId, type ReactNode } from 'react';

/** Dashboard card: title row with optional caption and trailing controls. */
export function Panel({ title, caption, actions, children, className = '', bodyClassName = 'px-5 pb-5' }: {
  title: string;
  caption?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={`flex min-w-0 flex-col rounded-2xl border border-line bg-surface ${className}`}>
      <header className="flex flex-wrap items-start justify-between gap-3 px-5 pb-4 pt-5">
        <div className="min-w-0">
          <h3 id={id} className="text-sm font-semibold tracking-tight text-ink">{title}</h3>
          {caption && <p className="mt-1 text-xs text-muted">{caption}</p>}
        </div>
        {actions}
      </header>
      <div className={`min-w-0 flex-1 ${bodyClassName}`}>{children}</div>
    </section>
  );
}

/** Compact segmented control used for chart ranges and view switches. */
export function Segmented<T extends string>({ value, options, onChange, label }: {
  value: T;
  options: { id: T; label: string }[];
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg border border-line bg-subtle p-0.5">
      {options.map((o) => {
        const active = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.id)}
            className={`rounded-md px-2.5 py-1 text-[11px] font-semibold tabular-nums transition-colors ${
              active ? 'bg-surface text-ink shadow-sm ring-1 ring-line' : 'text-muted hover:text-ink'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Tooltip body shared by every chart. Rows keep text in ink; a swatch carries identity. */
export function TooltipCard({ title, rows }: {
  title: ReactNode;
  rows: { label: string; value: ReactNode; swatch?: string; tone?: string }[];
}) {
  return (
    <div className="min-w-44 rounded-xl border border-line bg-surface px-3.5 py-3 text-xs shadow-lg shadow-black/10">
      <p className="mb-2 font-semibold text-ink">{title}</p>
      <dl className="space-y-1.5">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-6">
            <dt className="flex items-center gap-2 text-muted">
              {r.swatch && <span className="h-2 w-2 rounded-full" style={{ background: r.swatch }} aria-hidden="true" />}
              {r.label}
            </dt>
            <dd className={`font-semibold tabular-nums ${r.tone ?? 'text-ink'}`}>{r.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** Empty state sized like a chart so the grid does not jump when data arrives. */
export function ChartEmpty({ message, height = 220 }: { message: string; height?: number }) {
  return (
    <div className="flex items-center justify-center rounded-xl border border-dashed border-line bg-subtle text-center text-xs text-muted" style={{ height }}>
      <p className="max-w-60 px-4">{message}</p>
    </div>
  );
}
