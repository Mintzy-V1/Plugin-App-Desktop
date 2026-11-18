import type { ReactNode } from 'react';
const tones = { ok: 'bg-gain-soft text-gain', attention: 'bg-attention-soft text-attention', problem: 'bg-loss-soft text-loss', neutral: 'bg-subtle text-secondary' } as const;
export function StatusPill({ tone = 'neutral', children }: { tone?: keyof typeof tones; children: ReactNode }) {
  return <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold ${tones[tone]}`}>{children}</span>;
}
