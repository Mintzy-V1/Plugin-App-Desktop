import { useState, useEffect, useRef } from 'react';
import { StopCircle, AlertTriangle, Download, RefreshCw, Loader2, WifiOff, IndianRupee } from 'lucide-react';
import { pluginApi } from '../../lib/pluginApi';
import { useToast } from '../ui/Toast';
import ConfirmDialog from '../ui/ConfirmDialog';
import { sessionStatusLabel, resolveSessionStatus, isLiveSessionStatus } from '../../lib/sessionStatus';
import LivePnlPanel from './LivePnlPanel';

interface Props {
  sessionId: string;
  /** Known status from the sessions list (e.g. trading_active) — used until dashboard hydrates. */
  initialStatus?: string;
  /** Free cash captured from the TOTP / broker-connect response. */
  initialFreeCash?: number | null;
  /** Past / ended sessions open read-only (no stop controls, slower refresh). */
  readOnly?: boolean;
  onStop: () => void;
  onConfigure: () => void;
}

type Tab = 'logs' | 'pnl';

interface TradeLogRow {
  time: string;
  symbol: string;
  signal: string;
  action: string;
  price: string | number;
  change: string | number;
  pnl: string | number;
  capital: string | number;
  return_pct: string | number;
}

function pickStatus(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const nested = obj.status;
    if (typeof nested === 'string') return nested;
    if (nested && typeof nested === 'object' && typeof (nested as Record<string, unknown>).status === 'string') {
      return (nested as Record<string, unknown>).status as string;
    }
  }
  return null;
}

function pickCash(...sources: unknown[]): number | null {
  for (const src of sources) {
    if (src == null) continue;
    if (typeof src === 'number' && Number.isFinite(src)) return src;
    if (typeof src === 'object') {
      const o = src as Record<string, unknown>;
      const candidates = [o.cash_balance, o.free_cash, o.total_capital, o.available_cash, o.availablecash, o.AvailableCash, o.net];
      for (const c of candidates) {
        if (c == null || c === '') continue;
        const n = Number(c);
        if (Number.isFinite(n)) return n;
      }
      // nested data wrappers
      if (o.data && typeof o.data === 'object') {
        const nested = pickCash(o.data);
        if (nested != null) return nested;
      }
    }
  }
  return null;
}

function normalizeLogs(raw: unknown): TradeLogRow[] {
  let rows: unknown[] = [];
  if (Array.isArray(raw)) rows = raw;
  else if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    if (Array.isArray(o.rows)) rows = o.rows;
    else if (Array.isArray(o.logs)) rows = o.logs;
    else if (Array.isArray(o.data)) rows = o.data;
  }

  return rows.map((item) => {
    const r = (item && typeof item === 'object' ? item : {}) as Record<string, any>;
    const timeRaw = r.timestamp ?? r.time ?? r.Timestamp ?? r.Time;
    let time = '-';
    if (timeRaw != null) {
      if (typeof timeRaw === 'string' && timeRaw.includes('-') && !Number.isNaN(Date.parse(timeRaw))) {
        time = new Date(timeRaw).toLocaleString('en-IN');
      } else if (typeof timeRaw === 'number' || !Number.isNaN(Date.parse(String(timeRaw)))) {
        time = new Date(timeRaw).toLocaleString('en-IN');
      } else {
        time = String(timeRaw);
      }
    }

    return {
      time,
      symbol: String(r.Symbol ?? r.symbol ?? '-'),
      signal: String(r.Signal ?? r.signal ?? '-'),
      action: String(r.Action_Status ?? r.Action ?? r.action ?? r.action_status ?? r.status ?? '-'),
      price: r.Price ?? r.price ?? r.curr_price ?? '-',
      change: r['Change(%)'] ?? r.Change ?? r.change ?? r.return_pct ?? '-',
      pnl: r['P&L'] ?? r.PnL ?? r.pnl ?? r.unrealized_pnl ?? r.realized_pnl ?? '-',
      capital: r['Total_Capital'] ?? r.TotalCapital ?? r.total_capital ?? r.capital ?? r.cash_balance ?? '-',
      return_pct: r['Return(%)'] ?? r.Return ?? r.return ?? '-',
    };
  });
}

function formatMoney(n: number) {
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatCell(v: string | number, asMoney = false) {
  if (v === '-' || v == null || v === '') return '-';
  const n = Number(v);
  if (asMoney && Number.isFinite(n)) return formatMoney(n);
  if (Number.isFinite(n) && asMoney === false && typeof v === 'number') return n.toFixed(2);
  return String(v);
}

export default function LiveSessionDashboard({ sessionId, initialStatus, initialFreeCash, readOnly = false, onStop }: Props) {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>(readOnly ? 'logs' : 'pnl');
  const [logs, setLogs] = useState<TradeLogRow[]>([]);
  const [sessionStatus, setSessionStatus] = useState<string>(initialStatus || '');
  const [availableCash, setAvailableCash] = useState<number | null>(
    initialFreeCash != null && Number.isFinite(initialFreeCash) ? initialFreeCash : null
  );
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [confirming, setConfirming] = useState<'stop' | 'force' | null>(null);
  const [stopping, setStopping] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const isLive = !readOnly && isLiveSessionStatus(sessionStatus || initialStatus);

  const fetchDashboard = async () => {
    // Pull from several endpoints in parallel — same strategy as the web plugin UI.
    // A failure in one source must not blank out status / cash / logs.
    const [dashRes, statusRes, tradesRes, tsRes, pnlRes, fullRes] = await Promise.allSettled([
      pluginApi.getDashboard(sessionId),
      pluginApi.getSessionStatus(sessionId),
      pluginApi.getSessionTrades(sessionId),
      pluginApi.getSessionById(sessionId),
      pluginApi.getPnlSummary(sessionId),
      pluginApi.getFullSessionState(),
    ]);

    const dash = dashRes.status === 'fulfilled' ? dashRes.value.data : null;
    const pluginStatus = statusRes.status === 'fulfilled' ? statusRes.value.data : null;
    const tradesRaw = tradesRes.status === 'fulfilled' ? tradesRes.value.data : null;
    const tradingSession = tsRes.status === 'fulfilled'
      ? ((tsRes.value.data as any)?.session ?? tsRes.value.data)
      : null;
    const pnlSummary = pnlRes.status === 'fulfilled' ? pnlRes.value.data as Record<string, any> : null;
    const fullState = fullRes.status === 'fulfilled' ? fullRes.value.data : null;
    // /session always returns the user's latest session — only trust it for this id
    const fullMatches = fullState?.python_session_id === sessionId ? fullState : null;

    const anyOk = [dashRes, statusRes, tradesRes, tsRes, pnlRes, fullRes].some(r => r.status === 'fulfilled');
    setConnected(anyOk);

    const snapshot = (fullMatches?.snapshot as any)?.data
      || fullMatches?.snapshot
      || (dash?.snapshot as any)?.data
      || dash?.snapshot
      || null;

    const resolved = resolveSessionStatus(
      pickStatus(pluginStatus),
      pickStatus(fullMatches?.status),
      pickStatus(dash?.status),
      pickStatus(snapshot),
      pickStatus(tradingSession),
      initialStatus,
    );
    if (resolved) setSessionStatus(resolved);

    const cash = pickCash(snapshot, pluginStatus, fullMatches?.status, dash?.status, tradingSession, pnlSummary?.current);
    if (cash != null) setAvailableCash(cash);

    // Prefer live plugin execution trades (/session), then Mongo trading_logs.
    const fromPlugin = normalizeLogs(fullMatches?.logs);
    const fromTrades = normalizeLogs(tradesRaw);
    const fromDash = normalizeLogs(dash?.logs);
    if (fromPlugin.length > 0) setLogs(fromPlugin);
    else if (fromTrades.length > 0) setLogs(fromTrades);
    else if (fromDash.length > 0) setLogs(fromDash);
    // If all empty, keep previous logs so a flaky poll doesn't flash "No trades yet".

    if (anyOk) setLastUpdated(new Date());
    setLoading(false);
  };

  useEffect(() => {
    setLoading(true);
    setLogs([]);
    if (initialStatus) setSessionStatus(initialStatus);
    if (initialFreeCash != null && Number.isFinite(initialFreeCash)) setAvailableCash(initialFreeCash);
    setTab(readOnly ? 'logs' : 'pnl');
    fetchDashboard();

    // Live sessions poll; past sessions only need a one-shot load (plus a slow refresh).
    const ms = readOnly ? 60000 : 10000;
    intervalRef.current = setInterval(fetchDashboard, ms);
    return () => clearInterval(intervalRef.current);
  }, [sessionId, readOnly]);

  const handleStop = async (force: boolean) => {
    setStopping(true);
    try {
      if (force) await pluginApi.adminStopSession(sessionId);
      else await pluginApi.stopTrading(sessionId);
      toast.success(force ? 'Session force-stopped' : 'Session stopped');
      setSessionStatus('stopped');
      setConfirming(null);
      onStop();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Could not stop the session. It may still be running.');
      setConfirming(null);
    } finally {
      setStopping(false);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await pluginApi.downloadTradebook(sessionId);
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url; a.download = `tradebook-${sessionId}.csv`; a.click();
      URL.revokeObjectURL(url);
      toast.success('Tradebook CSV downloaded');
    } catch (err: any) {
      // Final tradebook may be gone after the VM stops — fall back to stored trading logs CSV.
      try {
        const fallback = await pluginApi.downloadSessionLogs(sessionId);
        const url = URL.createObjectURL(fallback.data);
        const a = document.createElement('a');
        a.href = url; a.download = `session-logs-${sessionId}.csv`; a.click();
        URL.revokeObjectURL(url);
        toast.success('Session logs CSV downloaded');
      } catch {
        const status = err?.response?.status;
        toast.error(status === 404
          ? 'No tradebook or logs are available for this session yet.'
          : 'Could not download the tradebook. Please try again.');
      }
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-slate-400">
        <RefreshCw className="h-6 w-6 animate-spin" aria-hidden="true" />
        <p className="text-sm">Loading session…</p>
      </div>
    );
  }

  const statusColor = (() => {
    const s = (sessionStatus || '').toLowerCase();
    if (['trading_active', 'active', 'running', 'started'].includes(s)) return 'text-emerald-600';
    if (['stopped', 'completed', 'abandoned'].includes(s)) return 'text-slate-500';
    if (['error', 'failed'].includes(s)) return 'text-red-600';
    return 'text-slate-900';
  })();

  return (
    <div className="page-stack">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-slate-200/80 bg-white px-4 py-3">
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Free cash</p>
          <p className="mt-0.5 flex items-center gap-1 text-[15px] font-semibold text-slate-900">
            <IndianRupee className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
            {availableCash != null ? formatMoney(availableCash).replace(/^₹\s?/, '') : <span className="font-medium text-slate-400">—</span>}
          </p>
        </div>

        <div className="hidden h-8 w-px bg-slate-100 sm:block" aria-hidden="true" />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Status</p>
            {!connected && (
              <span className="flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                <WifiOff className="h-3 w-3" aria-hidden="true" /> Reconnecting…
              </span>
            )}
          </div>
          <p className={`mt-0.5 text-[15px] font-semibold capitalize ${statusColor}`}>
            {sessionStatusLabel(sessionStatus) || 'Loading…'}
          </p>
          {lastUpdated && (
            <p className="text-[11px] text-slate-400">
              Updated {lastUpdated.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button type="button" onClick={handleDownload} disabled={downloading}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-semibold text-slate-600 transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30 disabled:opacity-50">
            {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Download className="h-3.5 w-3.5" aria-hidden="true" />}
            CSV
          </button>
          {isLive && (
            <>
              <button type="button" onClick={() => setConfirming('stop')}
                className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-2.5 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-amber-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40">
                <StopCircle className="h-3.5 w-3.5" aria-hidden="true" /> Stop
              </button>
              <button type="button" onClick={() => setConfirming('force')}
                className="flex items-center gap-1.5 rounded-lg bg-red-500 px-2.5 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40">
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" /> Force
              </button>
            </>
          )}
        </div>
      </div>

      <div role="tablist" aria-label="Session data" className="inline-flex gap-0.5 rounded-lg bg-slate-200/60 p-0.5">
        {(['logs', 'pnl'] as Tab[]).map(t => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
            className={`rounded-md px-3.5 py-1.5 text-[13px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30 ${
              tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}>
            {t === 'logs' ? 'Trade logs' : 'Live P&L'}
          </button>
        ))}
      </div>

      {/* Keep both panes mounted so Live P&L history/polling survives tab switches. */}
      <div hidden={tab !== 'pnl'}>
        <LivePnlPanel sessionId={sessionId} />
      </div>

      <div hidden={tab !== 'logs'}>
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          {logs.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm font-medium text-slate-500">No trades yet</p>
              <p className="mt-1 text-xs text-slate-400">Executed trades will appear here as the engine runs.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <th scope="col" className="px-3.5 py-2.5">Time</th>
                    <th scope="col" className="px-3.5 py-2.5">Symbol</th>
                    <th scope="col" className="px-3.5 py-2.5">Signal</th>
                    <th scope="col" className="px-3.5 py-2.5">Action</th>
                    <th scope="col" className="px-3.5 py-2.5 text-right">Price</th>
                    <th scope="col" className="px-3.5 py-2.5 text-right">Change</th>
                    <th scope="col" className="px-3.5 py-2.5 text-right">P&L</th>
                    <th scope="col" className="px-3.5 py-2.5 text-right">Capital</th>
                    <th scope="col" className="px-3.5 py-2.5 text-right">Return</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log, i) => {
                    const pnlNum = Number(log.pnl);
                    const changeNum = Number(log.change);
                    const pnlColor = Number.isFinite(pnlNum) ? (pnlNum >= 0 ? 'text-emerald-600' : 'text-red-600') : 'text-slate-700';
                    const changeColor = Number.isFinite(changeNum) ? (changeNum >= 0 ? 'text-emerald-600' : 'text-red-600') : 'text-slate-700';
                    return (
                      <tr key={i} className="border-b border-slate-50 text-slate-700 last:border-0 hover:bg-slate-50">
                        <td className="px-3.5 py-2 text-xs font-mono">{log.time}</td>
                        <td className="px-3.5 py-2 font-semibold">{log.symbol}</td>
                        <td className="px-3.5 py-2">
                          {log.signal !== '-' ? (
                            <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${
                              String(log.signal).toUpperCase() === 'BUY' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                            }`}>{log.signal}</span>
                          ) : '-'}
                        </td>
                        <td className="px-3.5 py-2">{log.action}</td>
                        <td className="px-3.5 py-2 text-right font-mono">{formatCell(log.price, true)}</td>
                        <td className={`px-3.5 py-2 text-right font-mono ${changeColor}`}>
                          {log.change === '-' ? '-' : `${Number.isFinite(changeNum) && changeNum > 0 ? '+' : ''}${formatCell(log.change)}${Number.isFinite(changeNum) ? '%' : ''}`}
                        </td>
                        <td className={`px-3.5 py-2 text-right font-mono ${pnlColor}`}>{formatCell(log.pnl, true)}</td>
                        <td className="px-3.5 py-2 text-right font-mono">{formatCell(log.capital, true)}</td>
                        <td className={`px-3.5 py-2 text-right font-mono ${changeColor}`}>
                          {log.return_pct === '-' ? '-' : `${formatCell(log.return_pct)}${Number.isFinite(Number(log.return_pct)) ? '%' : ''}`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog open={!!confirming}
        title={confirming === 'force' ? 'Force stop session?' : 'Stop session?'}
        description={confirming === 'force'
          ? 'This immediately terminates the engine. Open positions will not be closed automatically — you may need to exit them manually with your broker.'
          : 'The engine will finish gracefully: it stops taking new positions and winds down the session.'}
        confirmLabel={confirming === 'force' ? 'Force stop' : 'Stop session'}
        tone={confirming === 'force' ? 'danger' : 'warning'}
        busy={stopping}
        onConfirm={() => handleStop(confirming === 'force')}
        onCancel={() => { if (!stopping) setConfirming(null); }} />
    </div>
  );
}
