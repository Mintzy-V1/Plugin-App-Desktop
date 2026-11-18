import { useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { useDialogFocus } from './useDialogFocus';

interface Props {
  open: boolean;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  tone?: 'danger' | 'warning';
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open, title, description, confirmLabel, tone = 'danger', busy, onConfirm, onCancel,
}: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  useDialogFocus(open, dialogRef, cancelRef, onCancel, !busy);

  if (!open) return null;

  const confirmClass = tone === 'danger'
    ? 'bg-loss-soft text-loss hover:brightness-95 focus-visible:ring-loss'
    : 'bg-attention-soft text-attention hover:brightness-95 focus-visible:ring-attention';

  return (
    <div className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4 backdrop-blur-sm"
      onMouseDown={e => { if (e.target === e.currentTarget && !busy) onCancel(); }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title"
        className="animate-scale-in w-full max-w-sm rounded-xl border border-line bg-surface p-5 shadow-xl">
        <h3 id="confirm-dialog-title" className="text-[15px] font-semibold text-ink">{title}</h3>
        <div className="mt-1.5 text-sm leading-relaxed text-muted">{description}</div>
        <div className="mt-5 flex gap-2.5">
          <button ref={cancelRef} onClick={onCancel} disabled={busy}
            className="flex-1 rounded-lg border border-line px-3 py-2 text-sm font-semibold text-secondary transition-colors hover:bg-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={busy}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 disabled:opacity-60 ${confirmClass}`}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
