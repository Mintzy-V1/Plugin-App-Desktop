import { useState } from 'react';
import { BellOff, ChevronDown, ChevronRight, Copy } from 'lucide-react';
import { SEVERITY_LABEL, SEVERITY_STYLE, type SessionEvent } from '../../lib/sessionEvents';

interface Props {
  events: SessionEvent[];
  /** Admin view: show each event's raw broker / engine details */
  raw: boolean;
  /** The user window closed (48h after the session ended) */
  expired: boolean;
  expiresAt: string | null;
  loaded: boolean;
  /** Event ids the viewer has not opened yet, highlighted */
  unread: Set<string>;
}

function formatIst(value: string): string {
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return value || '-';
  return new Date(ms).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
}

function RawBlock({ event }: { event: SessionEvent }) {
  const [copied, setCopied] = useState(false);
  const payload = {
    event_id: event.event_id,
    code: event.code,
    category: event.category,
    broker: event.broker,
    account: event.account,
    vm: event.vm,
    user_visible: event.user_visible,
    raw: event.raw,
  };
  const text = JSON.stringify(payload, null, 2);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };
  return (
    <div className="mt-2 rounded-lg border border-slate-200 bg-slate-950">
      <div className="flex items-center justify-between border-b border-slate-800 px-3 py-1.5">
        <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400">raw</span>
        <button type="button" onClick={copy} className="flex items-center gap-1 text-[11px] font-medium text-slate-300 hover:text-white">
          <Copy className="h-3 w-3" aria-hidden="true" /> {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="max-h-72 overflow-auto px-3 py-2 font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-words text-slate-200">{text}</pre>
    </div>
  );
}

export default function SessionNotifications({ events, raw, expired, expiresAt, loaded, unread }: Props) {
  const [open, setOpen] = useState<Record<string, boolean>>({});

  if (expired) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center">
        <BellOff className="mx-auto h-5 w-5 text-slate-300" aria-hidden="true" />
        <p className="mt-2 text-sm font-medium text-slate-600">Notifications for this session have expired</p>
        <p className="mt-1 text-xs text-slate-400">They are kept for 48 hours after a session ends.</p>
      </div>
    );
  }

  if (loaded && events.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center">
        <p className="text-sm font-medium text-slate-600">No notifications</p>
        <p className="mt-1 text-xs text-slate-400">
          Problems with your broker, orders or Mintzy's services during this session will show up here.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      {!raw && expiresAt && (
        <p className="border-b border-slate-100 bg-slate-50/80 px-4 py-2 text-[11px] text-slate-500">
          Kept until {formatIst(expiresAt)} IST (48 hours after the session ended).
        </p>
      )}
      <ul className="divide-y divide-slate-100">
        {events.map((e) => {
          const style = SEVERITY_STYLE[e.severity];
          const isOpen = !!open[e.event_id];
          const isUnread = unread.has(e.event_id);
          return (
            <li key={e.event_id} className={`border-l-4 px-4 py-3 ${style.accent} ${isUnread ? 'bg-amber-50/40' : ''}`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ${style.chip}`}>
                  {SEVERITY_LABEL[e.severity]}
                </span>
                <span className="text-[13px] font-semibold text-slate-900">{e.title}</span>
                {e.symbol && (
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-600">{e.symbol}</span>
                )}
                {e.count > 1 && (
                  <span className="text-[11px] font-medium text-slate-500" title="How many times this happened">×{e.count}</span>
                )}
                {raw && !e.user_visible && (
                  <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white">Admin only</span>
                )}
                <span className="ml-auto text-[11px] text-slate-400">
                  {e.count > 1 ? `${formatIst(e.first_at)} – ${formatIst(e.last_at)}` : formatIst(e.last_at)}
                </span>
              </div>
              {e.message && <p className="mt-1 text-[13px] leading-relaxed text-slate-600">{e.message}</p>}
              {e.action && <p className="mt-1 text-[12px] leading-relaxed text-slate-500"><span className="font-semibold">What you can do:</span> {e.action}</p>}
              <div className="mt-1.5 flex items-center gap-3 text-[11px] text-slate-400">
                <span className="font-mono">Ref {e.event_id}</span>
                {raw && (
                  <span className="font-mono">{e.code}</span>
                )}
                {raw && (
                  <button
                    type="button"
                    onClick={() => setOpen((prev) => ({ ...prev, [e.event_id]: !isOpen }))}
                    className="flex items-center gap-0.5 font-semibold text-slate-600 hover:text-slate-900"
                    aria-expanded={isOpen}
                  >
                    {isOpen ? <ChevronDown className="h-3 w-3" aria-hidden="true" /> : <ChevronRight className="h-3 w-3" aria-hidden="true" />}
                    Raw details
                  </button>
                )}
              </div>
              {raw && isOpen && <RawBlock event={e} />}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
