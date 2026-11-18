import type { ReactNode } from 'react';
import { Card } from './Card';
export function StatTile({ label, value, delta }: { label: string; value: ReactNode; delta?: ReactNode }) {
  return <Card className="px-6 py-5"><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">{label}</p>
    <div className="mt-3 font-serif text-3xl tabular-nums text-ink">{value}</div>
    {delta && <div className="mt-2 text-xs text-secondary">{delta}</div>}
  </Card>;
}
