import { useEffect, useState } from 'react';
import { Radio, WifiOff } from 'lucide-react';
import { adminApi, type SignalLiveStatus } from '../../lib/adminApi';
import { Card } from '../../components/ui/Card';
import { StatusPill } from '../../components/ui/StatusPill';
import { formatMoney, pnlClass } from './adminFormat';

const POLL_MS = 10000;

type Reachable = Extract<SignalLiveStatus, { reachable: true }>;

const PHASE_META: Record<string, { label: string; tone: 'ok' | 'attention' | 'problem' | 'neutral' }> = {
  running: { label: 'Trading (paper engine running)', tone: 'ok' },
  warmup: { label: 'Warming up', tone: 'attention' },
  waiting: { label: 'Waiting for the start time', tone: 'neutral' },
  idle: { label: 'Idle (outside trading hours)', tone: 'neutral' },
  starting: { label: 'Starting', tone: 'attention' },
  stopped: { label: 'Stopped for the day', tone: 'neutral' },
  error: { label: 'Error', tone: 'problem' },
};
const phaseMeta = (phase: string | null) =>
  (phase && Object.prototype.hasOwnProperty.call(PHASE_META, phase) ? PHASE_META[phase] : { label: phase ?? 'Unknown', tone: 'neutral' as const });

const age = (seconds: number | null) => {
  if (seconds == null) return 'no tick yet';
  if (seconds < 60) return `${Math.round(seconds)}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
};

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] text-muted">{label}</dt>
      <dd className="mt-0.5 truncate text-[13px] tabular-nums text-ink">{children}</dd>
    </div>
  );
}

function Live({ s }: { s: Reachable }) {
  const phase = phaseMeta(s.phase);
  const trading = s.phase === 'running' || s.phase === 'warmup';
  const feed = s.feed_stale ? <span className="text-loss">Stale · last tick {age(s.seconds_since_last_tick)}</span>
    : trading ? <span className="text-gain">Fresh · last tick {age(s.seconds_since_last_tick)}</span>
      : <span className="text-secondary">Not trading</span>;
  const paper = (s.realized_pnl ?? 0) + (s.unrealized_pnl ?? 0);
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill tone={phase.tone}>{phase.label}</StatusPill>
        {s.status === 'error' && <StatusPill tone="problem">Service reports an error</StatusPill>}
        {s.rms_triggered && <StatusPill tone="problem">Risk limit triggered</StatusPill>}
        {s.eod_exit_done && <StatusPill tone="neutral">Square-off done</StatusPill>}
        {s.pyramid && (s.pyramid.live_allowed
          ? <StatusPill tone="ok">Publishing {s.pyramid.live_symbols.join(', ') || '—'}</StatusPill>
          : <StatusPill tone="attention">Not publishing</StatusPill>)}
      </div>
      {s.detail && <p className="mt-2 text-xs text-muted">{s.detail}</p>}
      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 md:grid-cols-3 xl:grid-cols-6">
        <Fact label="Price feed">{feed}</Fact>
        <Fact label="Engine">{s.trader_alive ? <span className="text-gain">Alive</span> : <span className="text-secondary">Not running</span>}</Fact>
        <Fact label="Signals today">{s.signals_emitted ?? '—'}{s.signals_dropped ? <span className="text-loss"> · {s.signals_dropped} dropped</span> : null}</Fact>
        <Fact label="Waiting to send">{s.outbox_open ?? '—'}</Fact>
        <Fact label="Paper P&L (engine estimate)"><span title="The engine's running figure. The result at close is computed from the signal journal and can differ." className={pnlClass(paper)}>{formatMoney(s.realized_pnl == null && s.unrealized_pnl == null ? null : paper)}</span></Fact>
        <Fact label="Restarts today">{s.restarts ?? '—'}</Fact>
      </dl>
      {s.destinations.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {s.destinations.map((d) => (
            <span key={d.name} className={`rounded-md px-2 py-1 text-[11px] font-medium ring-1 ${d.consecutive_failures ? 'bg-attention-soft text-attention ring-attention/25' : 'bg-subtle text-secondary ring-line'}`}>
              <span className="capitalize">{d.name}</span>{d.dry_run ? ' (dry run)' : ''} · {d.sent ?? 0} sent · {d.failed ?? 0} failed
              {d.consecutive_failures ? ` · ${d.consecutive_failures} failing in a row` : ''}
            </span>
          ))}
        </div>
      )}
      {s.positions.length > 0 && (
        <table className="mt-4 w-full text-left text-xs tabular-nums">
          <caption className="sr-only">Open paper positions</caption>
          <thead className="text-[10px] uppercase tracking-wider text-muted">
            <tr><th className="py-1 pr-3 font-semibold">Open position</th><th className="py-1 pr-3 font-semibold">Side</th><th className="py-1 pr-3 text-right font-semibold">Qty</th><th className="py-1 pr-3 text-right font-semibold">Avg</th><th className="py-1 pr-3 text-right font-semibold">LTP</th><th className="py-1 text-right font-semibold">Open P&L</th></tr>
          </thead>
          <tbody className="divide-y divide-line text-secondary">
            {s.positions.map((p) => (
              <tr key={p.symbol}>
                <td className="py-1.5 pr-3 font-medium text-ink">{p.symbol}{s.pyramid?.live_symbols.includes(p.symbol) ? <span className="ml-1.5 text-[10px] text-gain">published</span> : null}</td>
                <td className="py-1.5 pr-3">{p.side ?? '—'}</td>
                <td className="py-1.5 pr-3 text-right">{p.qty ?? '—'}</td>
                <td className="py-1.5 pr-3 text-right">{formatMoney(p.avg_price)}</td>
                <td className="py-1.5 pr-3 text-right">{formatMoney(p.ltp)}</td>
                <td className={`py-1.5 text-right ${pnlClass(p.unrealized_pnl)}`}>{formatMoney(p.unrealized_pnl)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

/** The signal service right now: up or not, feed fresh, what it holds. Polled while shown. */
export function SignalLiveStatusCard() {
  const [status, setStatus] = useState<SignalLiveStatus | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let busy = false;
    const load = () => {
      if (busy) return;
      busy = true;
      adminApi.getSignalStatus()
        .then((res) => { if (!cancelled) { setStatus(res.data.status); setFailed(false); } })
        .catch(() => { if (!cancelled) setFailed(true); })
        .finally(() => { busy = false; });
    };
    load();
    const id = setInterval(load, POLL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  if (status && !status.configured) {
    return (
      <p className="flex items-center gap-2 text-xs text-muted">
        <Radio className="h-3.5 w-3.5" aria-hidden="true" /> Live status is not connected to the signal service yet.
      </p>
    );
  }

  return (
    <Card className="px-6 py-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
          <Radio className="h-3.5 w-3.5 text-brand" aria-hidden="true" /> Signal service · live
        </p>
        <p className="text-xs text-muted">
          {failed ? <span className="flex items-center gap-1 text-attention"><WifiOff className="h-3 w-3" aria-hidden="true" /> Gateway not answering · retrying</span>
            : status && 'checked_at' in status ? `Checked ${new Date(status.checked_at).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit' })} · every 10 seconds` : 'Checking…'}
        </p>
      </div>
      <div className="mt-3">
        {!status && !failed && <p className="text-[13px] text-muted">Checking the signal service…</p>}
        {status && status.configured && !status.reachable && (
          <div role="alert" className="rounded-lg border border-loss/25 bg-loss-soft px-4 py-3 text-[13px] text-loss">
            The signal service is not answering. It may be down, restarting or being deployed; its alerts will say which.
          </div>
        )}
        {status && status.configured && status.reachable && <Live s={status} />}
      </div>
    </Card>
  );
}
