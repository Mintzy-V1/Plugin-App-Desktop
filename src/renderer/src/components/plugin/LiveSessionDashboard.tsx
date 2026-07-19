import { useState, useEffect, useRef } from 'react';
import { StopCircle, AlertTriangle, Download, RefreshCw } from 'lucide-react';
import { pluginApi } from '../../lib/pluginApi';
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

export default function LiveSessionDashboard({ sessionId, onStop, onConfigure }: Props) {
  const [tab, setTab] = useState<Tab>('pnl');
  const [logs, setLogs] = useState<TradeLog[]>([]);
  const [sessionStatus, setSessionStatus] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState<'stop' | 'force' | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  const fetchDashboard = async () => {
    try {
      const res = await pluginApi.getDashboard(sessionId);
      if (res.data?.status) {
        setSessionStatus(res.data.status as string);
        setLogs((res.data.logs || []) as TradeLog[]);
      }
    } catch {} finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
    intervalRef.current = setInterval(fetchDashboard, 10000);
    return () => clearInterval(intervalRef.current);
  }, [sessionId]);

  const handleStop = async () => {
    try { await pluginApi.stopTrading(sessionId); } catch {}
    setConfirming(null);
    onStop();
  };

  const handleForceStop = async () => {
    try { await pluginApi.adminStopSession(sessionId); } catch {}
    setConfirming(null);
    onStop();
  };

  const handleDownload = async () => {
    try {
      const res = await pluginApi.downloadTradebook(sessionId);
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url; a.download = `tradebook-${sessionId}.csv`; a.click();
      URL.revokeObjectURL(url);
    } catch {}
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Session Status</p>
          <p className="mt-0.5 text-sm font-semibold text-slate-900">{sessionStatus || 'Active'}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleDownload}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50">
            <Download className="h-3.5 w-3.5" /> CSV
          </button>
          <button onClick={() => setConfirming('stop')}
            className="flex items-center gap-1.5 rounded-xl bg-amber-500 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-amber-600">
            <StopCircle className="h-3.5 w-3.5" /> Stop
          </button>
          <button onClick={() => setConfirming('force')}
            className="flex items-center gap-1.5 rounded-xl bg-red-500 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-red-600">
            <AlertTriangle className="h-3.5 w-3.5" /> Force Stop
          </button>
        </div>
      </div>

      <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
        {(['logs', 'pnl'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
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
            <div className="p-8 text-center text-sm text-slate-400">No trade logs yet</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <th className="px-4 py-3">Time</th>
                    <th className="px-4 py-3">Symbol</th>
                    <th className="px-4 py-3">Signal</th>
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Price</th>
                    <th className="px-4 py-3 text-right">Change</th>
                    <th className="px-4 py-3 text-right">P&L</th>
                    <th className="px-4 py-3 text-right">Capital</th>
                    <th className="px-4 py-3 text-right">Return</th>
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

      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/20 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900">
              {confirming === 'force' ? 'Force Stop Session?' : 'Stop Session?'}
            </h3>
            <p className="mt-2 text-sm text-slate-500">
              {confirming === 'force'
                ? 'This will forcefully terminate the trading session.'
                : 'This will stop the trading session gracefully.'}
            </p>
            <div className="mt-6 flex gap-3">
              <button onClick={() => setConfirming(null)}
                className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50">
                Cancel
              </button>
              <button onClick={confirming === 'force' ? handleForceStop : handleStop}
                className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-colors ${
                  confirming === 'force' ? 'bg-red-500 hover:bg-red-600' : 'bg-amber-500 hover:bg-amber-600'
                }`}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
