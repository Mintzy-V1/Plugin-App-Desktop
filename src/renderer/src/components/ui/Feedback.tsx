import { Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from './Button';
export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return <div role="status" className="flex items-center justify-center gap-2 p-6 text-sm text-muted"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />{label}</div>;
}
export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return <div className="px-6 py-12 text-center"><p className="font-serif text-xl text-ink">{title}</p>{description && <p className="mx-auto mt-2 max-w-md text-sm text-secondary">{description}</p>}{action && <div className="mt-5">{action}</div>}</div>;
}
export function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <div role="alert" className="flex items-center justify-between gap-4 rounded-lg border border-loss/20 bg-loss-soft p-4 text-sm text-loss"><p>{message}</p><Button variant="secondary" size="sm" onClick={onRetry}>Retry</Button></div>;
}
