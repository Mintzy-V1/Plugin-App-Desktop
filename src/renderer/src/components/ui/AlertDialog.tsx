import { useRef, useState } from 'react';
import { AlertOctagon, AlertTriangle, Check, Copy } from 'lucide-react';
import { useDialogFocus } from './useDialogFocus';

interface Props {
  open: boolean;
  tone: 'critical' | 'error';
  title: string;
  message: string;
  /** "What you can do" */
  action?: string;
  /** Reference the user can quote to Mintzy support */
  reference?: string;
  /** Extra context line, e.g. the stock and how many times it happened */
  meta?: string;
  onClose: () => void;
  /** Optional second button, e.g. open the Notifications tab */
  secondaryLabel?: string;
  onSecondary?: () => void;
}

/** A single-acknowledgement popup for something the user must know about. */
export default function AlertDialog({
  open, tone, title, message, action, reference, meta, onClose, secondaryLabel, onSecondary,
}: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const okRef = useRef<HTMLButtonElement>(null);
  const [copied, setCopied] = useState(false);
  useDialogFocus(open, dialogRef, okRef, onClose);

  if (!open) return null;

  const critical = tone === 'critical';
  const Icon = critical ? AlertOctagon : AlertTriangle;

  const copyReference = async () => {
    if (!reference) return;
    try {
      await navigator.clipboard.writeText(reference);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked: the reference stays visible to read out
    }
  };

  return (
    <div
      className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-message"
        className={`animate-scale-in w-full max-w-md rounded-xl border bg-white p-5 shadow-xl ${critical ? 'border-red-200' : 'border-orange-200'}`}
      >
        <div className="flex items-start gap-3">
          <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${critical ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'}`}>
            <Icon className="h-4.5 w-4.5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 id="alert-dialog-title" className="text-[15px] font-semibold text-slate-900">{title}</h3>
            {meta && <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">{meta}</p>}
            <p id="alert-dialog-message" className="mt-2 text-sm leading-relaxed text-slate-600">{message}</p>
            {action && (
              <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">What you can do</p>
                <p className="mt-0.5 text-[13px] leading-relaxed text-slate-700">{action}</p>
              </div>
            )}
            {reference && (
              <button
                type="button"
                onClick={copyReference}
                className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-2 py-1 font-mono text-[11px] text-slate-600 transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30"
                title="Copy this reference for Mintzy support"
              >
                {copied ? <Check className="h-3 w-3 text-emerald-600" aria-hidden="true" /> : <Copy className="h-3 w-3" aria-hidden="true" />}
                Ref {reference}
              </button>
            )}
          </div>
        </div>
        <div className="mt-5 flex gap-2.5">
          {secondaryLabel && onSecondary && (
            <button
              type="button"
              onClick={onSecondary}
              className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30"
            >
              {secondaryLabel}
            </button>
          )}
          <button
            ref={okRef}
            type="button"
            onClick={onClose}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold text-white transition-colors focus:outline-none focus-visible:ring-2 ${critical ? 'bg-red-500 hover:bg-red-600 focus-visible:ring-red-500/40' : 'bg-orange-500 hover:bg-orange-600 focus-visible:ring-orange-500/40'}`}
          >
            OK, got it
          </button>
        </div>
      </div>
    </div>
  );
}
