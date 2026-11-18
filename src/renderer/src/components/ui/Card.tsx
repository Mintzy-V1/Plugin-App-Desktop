import { useId, type HTMLAttributes, type ReactNode } from 'react';
export function Card({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`rounded-xl border border-line bg-surface ${className}`} {...props} />;
}
export function Section({ title, description, children, actions }: { title: string; description?: string; children: ReactNode; actions?: ReactNode }) {
  const id = useId();
  return <section aria-labelledby={id} className="overflow-hidden rounded-xl border border-line bg-surface">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-6 py-5">
      <div><h2 id={id} className="text-sm font-semibold text-ink">{title}</h2>{description && <p className="mt-1 text-xs text-secondary">{description}</p>}</div>{actions}
    </div>{children}
  </section>;
}
