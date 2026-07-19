import { useState, useEffect, useRef } from 'react';
import { StopCircle, AlertTriangle, Download, RefreshCw, Loader2, WifiOff } from 'lucide-react';
import { pluginApi } from '../../lib/pluginApi';
import { useToast } from '../ui/Toast';
import ConfirmDialog from '../ui/ConfirmDialog';
import { sessionStatusLabel } from '../../lib/sessionStatus';
import LivePnlPanel from './LivePnlPanel';

interface Props {
  sessionId: string;
  onStop: () => void;
  onConfigure: () => void;
}

type Tab = 'logs' | 'pnl';

interface TradeLog {
  time?: string;
  symbol?: string;
  signal?: string;
  action?: string;
  status?: string;
  price?: number;
  change?: number;
  pnl?: number;
  capital?: number;
  return_pct?: number;
}

export default function LiveSessionDashboard({ sessionId, onStop }: Props) {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('pnl');
  const [logs, setLogs] = useState<TradeLog[]>([]);
  const [sessionStatus, setSessionStatus] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [confirming, setConfirming] = useState<'stop' | 'force' | null>(null);
  const [stopping, setStopping] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const fetchDashboard = async () => {
    try {
      const res = await pluginApi.getDashboard(sessionId);
      const rawStatus = res.data?.status;
      if (rawStatus) {
        setSessionStatus(typeof rawStatus === 'string' ? rawStatus : String((rawStatus as Record<string, unknown>).status ?? ''));
        setLogs((res.data.logs || []) as TradeLog[]);
      }
      setConnected(true);
      setLastUpdated(new Date());
    } catch {
      setConnected(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchDashboard();
    intervalRef.current = setInterval(fetchDashboard, 10000);
    return () => clearInterval(intervalRef.current);
  }, [sessionId]);

  const handleStop = async (force: boolean) => {
    setStopping(true);
    try {
      if (force) await pluginApi.adminStopSession(sessionId);
      else await pluginApi.stopTrading(sessionId);
      toast.success(force ? 'Session force-stopped' : 'Session stopped');
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
    } catch {
      toast.error('Could not download the tradebook. Please try again.');
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Session Status</p>
            {!connected && (
              <span className="flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                <WifiOff className="h-3 w-3" aria-hidden="true" /> Reconnecting…
              </span>
            )}
          </div>
          <p className="mt-0.5 text-sm font-semibold text-slate-900">{sessionStatusLabel(sessionStatus) || 'Active'}</p>
          {lastUpdated && (
            <p className="mt-0.5 text-[11px] text-slate-400">Updated {lastUpdated.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleDownload} disabled={downloading}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:opacity-50">
            {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Download className="h-3.5 w-3.5" aria-hidden="true" />} CSV
          </button>
          <button onClick={() => setConfirming('stop')}
            className="flex items-center gap-1.5 rounded-xl bg-amber-500 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-amber-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40">
            <StopCircle className="h-3.5 w-3.5" aria-hidden="true" /> Stop
          </button>
          <button onClick={() => setConfirming('force')}
            className="flex items-center gap-1.5 rounded-xl bg-red-500 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" /> Force Stop
          </button>
        </div>
      </div>

      <div role="tablist" aria-label="Session data" className="flex gap-1 rounded-xl bg-slate-100 p-1">
        {(['logs', 'pnl'] as Tab[]).map(t => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 ${
              tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}>
            {t === 'logs' ? 'Trade Logs' : 'Live P&L'}
          </button>
        ))}
      </div>

      {tab === 'pnl' && <LivePnlPanel sessionId={sessionId} />}

      {tab === 'logs' && (
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          {logs.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-sm font-medium text-slate-500">No trades yet</p>
              <p className="mt-1 text-xs text-slate-400">Executed trades will appear here as the engine runs.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <th scope="col" className="px-4 py-3">Time</th>
                    <th scope="col" className="px-4 py-3">Symbol</th>
                    <th scope="col" className="px-4 py-3">Signal</th>
                    <th scope="col" className="px-4 py-3">Action</th>
                    <th scope="col" className="px-4 py-3">Status</th>
                    <th scope="col" className="px-4 py-3 text-right">Price</th>
                    <th scope="col" className="px-4 py-3 text-right">Change</th>
                    <th scope="col" className="px-4 py-3 text-right">P&L</th>
                    <th scope="col" className="px-4 py-3 text-right">Capital</th>
                    <th scope="col" className="px-4 py-3 text-right">Return</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log, i) => (
                    <tr key={i} className="border-b border-slate-50 text-slate-700 last:border-0 hover:bg-slate-50">
                      <td className="px-4 py-2.5 text-xs font-mono">{log.time || '-'}</td>
                      <td className="px-4 py-2.5 font-semibold">{log.symbol || '-'}</td>
                      <td className="px-4 py-2.5">
                        <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${
                          log.signal === 'BUY' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                        }`}>{log.signal || '-'}</span>
                      </td>
                      <td className="px-4 py-2.5">{log.action || '-'}</td>
                      <td className="px-4 py-2.5">{log.status || '-'}</td>
                      <td className="px-4 py-2.5 text-right font-mono">{log.price?.toFixed(2) || '-'}</td>
                      <td className={`px-4 py-2.5 text-right font-mono ${(log.change || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {log.change != null ? `${log.change >= 0 ? '+' : ''}${log.change.toFixed(2)}` : '-'}
                      </td>
                      <td className={`px-4 py-2.5 text-right font-mono ${(log.pnl || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {log.pnl != null ? `₹${log.pnl.toFixed(2)}` : '-'}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono">{log.capital != null ? `₹${log.capital.toFixed(2)}` : '-'}</td>
                      <td className={`px-4 py-2.5 text-right font-mono ${(log.return_pct || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {log.return_pct != null ? `${log.return_pct >= 0 ? '+' : ''}${log.return_pct.toFixed(2)}%` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

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
