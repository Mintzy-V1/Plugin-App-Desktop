import type { ReactNode } from 'react';
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return <div className="flex flex-wrap items-end justify-between gap-4 py-2">
    <div><h1 className="font-serif text-3xl tracking-tight text-ink">{title}</h1>
      {subtitle && <p className="mt-2 text-sm text-secondary">{subtitle}</p>}</div>
    {actions && <div className="flex items-center gap-2">{actions}</div>}
  </div>;
}
