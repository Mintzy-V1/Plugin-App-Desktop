import { useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw, WifiOff, X } from 'lucide-react';
import {
  adminApi,
  type SignalPyramidDay,
  type SignalPyramidDayListItem,
  type SignalPyramidStatus,
  type SignalPyramidSymbol,
} from '../../lib/adminApi';
import { istDateKey, isBeforeIstWallClock } from '../../lib/istClock';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { StatTile } from '../../components/ui/StatTile';
import { StatusPill } from '../../components/ui/StatusPill';
import { Card } from '../../components/ui/Card';
import { EmptyState, LoadError, Spinner, formatDateTime, formatMoney, inputClass, pnlClass, secondaryButtonClass } from './adminFormat';

/** Today's book changes after 13:00 (names not opened); earlier days do not. */
const TODAY_POLL_MS = 30000;
const CLOCK_TICK_MS = 60000;
const DAYS_SHOWN = 30;
/** The signal service writes the day's book at SIGNAL_SEND_FROM (13:00), after a fresh
 *  prediction call and the handoff wait, so allow it a few minutes before calling it late. */
const HANDOFF_HOUR = 13;
const HANDOFF_GRACE_MINUTES = 10;
const MIN_DATE = '2025-01-01';

/** The pyramid result's `reason`, in words. */
const REASON_LABELS: Record<string, string> = {
  ok: 'Published',
  no_tradeable_symbols: 'No PROFIT name with a pyramid share',
  no_profitable_symbols: 'No symbol beat its profit threshold',
  no_profitable_with_valid_rank: 'No profitable symbol with a valid rank',
  no_symbols_for_live: 'No symbol left to go live',
  no_symbols_to_evaluate: 'The morning traded no symbol of the configuration',
  configuration_symbols_missing: 'The saved configuration has no symbol list',
  broker_cash_unavailable: 'The configuration has no broker cash',
  free_cash_non_positive: 'The configuration’s broker cash is zero',
  capital_after_static_non_positive: 'Sized capital came to zero',
  dynamic_multiplier_non_positive: 'Sized capital came to zero',
  mongo_save_failed: 'The book could not be saved, so nothing was published',
};

// Own-property lookups only: a reason like "constructor" must not hit Object.prototype.
const hasOwn = (object: object, key: string) => Object.prototype.hasOwnProperty.call(object, key);

const reasonLabel = (reason: string | null) => {
  if (!reason) return '—';
  return hasOwn(REASON_LABELS, reason) ? REASON_LABELS[reason] : reason;
};

const STATUS_META: Record<SignalPyramidStatus, { label: string; tone: 'ok' | 'attention' | 'neutral' }> = {
  live: { label: 'Live', tone: 'ok' },
  not_opened: { label: 'Not opened', tone: 'attention' },
  dropped: { label: 'Dropped', tone: 'neutral' },
};
const statusMeta = (status: string) => (hasOwn(STATUS_META, status) ? STATUS_META[status as SignalPyramidStatus] : { label: status, tone: 'neutral' as const });

const formatShares = (qty: number | null) => (qty == null ? '—' : qty.toLocaleString('en-IN'));

const formatNumber = (n: number | null | undefined, digits = 2) =>
  n == null || !Number.isFinite(n) ? '—' : n.toLocaleString('en-IN', { maximumFractionDigits: digits });

/** "₹1.60L" style, for the compact chips in the days list. */
const formatLakh = (n: number) => (Math.abs(n) >= 100000 ? `₹${(n / 100000).toFixed(2)}L` : formatMoney(n));

const formatDay = (date: string) =>
  new Date(`${date}T00:00:00+05:30`).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

const isWeekend = (date: string) => [0, 6].includes(new Date(`${date}T12:00:00+05:30`).getUTCDay());

const strategyLabel = (strategy: string | null) =>
  strategy === 'exp104' ? 'EXP104' : strategy === 'threshold' ? 'Rank threshold' : strategy ? strategy : 'Strategy unknown';

/** Why there is no book for `date`, by the IST clock. */
function missingMessage(date: string, today: string): { title: string; body: string } {
  if (isWeekend(date)) return { title: `No pyramid on ${formatDay(date)}`, body: 'Markets are closed on weekends.' };
  if (date === today && isBeforeIstWallClock(HANDOFF_HOUR, 0)) {
    return {
      title: 'Today’s pyramid is not decided yet',
      body: 'The morning run is in progress. The signal service writes the book at 13:00 IST, and it shows here within a minute of that.',
    };
  }
  if (date === today && isBeforeIstWallClock(HANDOFF_HOUR, HANDOFF_GRACE_MINUTES)) {
    return {
      title: 'Today’s pyramid is being decided',
      body: 'The 13:00 handoff is running (fresh predictions, then the book). It shows here as soon as it is saved.',
    };
  }
  if (date === today) {
    return {
      title: 'No pyramid recorded today',
      body: 'It is past 13:00 and the signal service wrote nothing: it may have skipped the day (holiday or no ticks), or stopped before the handoff. Check its alerts.',
    };
  }
  return { title: `No pyramid recorded for ${formatDay(date)}`, body: 'The service did not trade that day (a holiday), skipped it, or stopped before 13:00.' };
}

/** Labels for the EXP104 sizing fields shown in the detail panel; others show their raw name. */
const SIZING_LABELS: Record<string, string> = {
  group: 'Group',
  score: 'Score',
  score_1x: 'Score (one seat)',
  score_source: 'Score source',
  unrealized_1259: 'Unrealized at 12:59',
  sim1x: 'Morning P&L (one seat)',
  wb: 'Rank weight (wb)',
  wp: 'Pyramid weight (wp)',
  wh: 'History weight (wh)',
  history_factor: 'History factor',
  history_n: 'History days',
  trajectory_1030: 'Trajectory 10:30',
  trajectory_1145: 'Trajectory 11:45',
  trajectory_1300: 'Trajectory 13:00',
  trajectory_status: 'Trajectory status',
  trajectory_factor: 'Trajectory factor',
  flip_1300: 'Flip at 13:00',
  account_scale: 'Account scale',
  raw_pyramid: 'Research pyramid (₹)',
  desired_pyramid: 'Desired pyramid (₹)',
  price_1300: '13:00 price',
  pyramid_quantity: 'Pyramid shares',
  pyramid_status: 'Pyramid status',
  base_quantity: 'Research base shares (not published)',
  base_status: 'Research base status',
  live_capital: 'Live capital',
  pyramid_unit: 'Research seat (₹)',
  source_ok: 'Opens at 13:00',
  wh_bucket: 'History bucket',
  history_passes: 'History tests passed',
  rank1_cut: 'Rank-1 half cut',
  seat: 'Seat (₹)',
  keep: 'Seat kept (₹)',
  extra: 'Freed seat received (₹)',
  raw_base: 'Research base (₹)',
  desired_base: 'Desired base (₹, not published)',
  total_quantity: 'Research total shares',
  pyramid_capital: 'Pyramid capital',
  exec_capital: 'Executed capital',
  trajectory_1300_source: 'Trajectory 13:00 source',
};
const SIZING_ORDER = Object.keys(SIZING_LABELS);

const MONEY_FIELDS = new Set(['price_1300', 'unrealized_1259', 'sim1x', 'raw_base', 'raw_pyramid', 'desired_base', 'desired_pyramid', 'pyramid_capital', 'exec_capital', 'live_capital', 'seat', 'keep', 'extra', 'pyramid_unit']);

const formatSizingValue = (key: string, value: unknown): string => {
  if (value == null) return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return MONEY_FIELDS.has(key) ? formatMoney(value) : formatNumber(value, 4);
  if (typeof value === 'string') return value;
  return '—';   // never render an object: the gateway sends primitives only, but do not trust it
};

function SymbolDetail({ symbol, onClose }: { symbol: SignalPyramidSymbol; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [symbol.symbol]);

  // strategy is the page's, morning_capital is in the first rows already
  const sizing = symbol.sizing ? Object.entries(symbol.sizing).filter(([key]) => key !== 'strategy' && key !== 'morning_capital') : [];
  const ordered = [
    ...sizing.filter(([key]) => hasOwn(SIZING_LABELS, key)).sort(([a], [b]) => SIZING_ORDER.indexOf(a) - SIZING_ORDER.indexOf(b)),
    ...sizing.filter(([key]) => !hasOwn(SIZING_LABELS, key)),
  ];
  const rows: [string, React.ReactNode][] = [
    ['Rank', symbol.rank ?? '—'],
    ['Morning position', symbol.position_status ? `${symbol.position_status}${symbol.exit_reason ? ` (${symbol.exit_reason})` : ''}` : '—'],
    ['Morning capital', formatMoney(symbol.morning_capital)],
    ['Morning booked P&L', <span className={pnlClass(symbol.realized_pnl)}>{formatMoney(symbol.realized_pnl)}</span>],
    ['Morning open P&L', <span className={pnlClass(symbol.unrealized_pnl)}>{formatMoney(symbol.unrealized_pnl)}</span>],
    ['Profit threshold', formatMoney(symbol.profit_threshold)],
    ['Stop loss', symbol.stop_loss == null ? '—' : formatNumber(symbol.stop_loss, 4)],
    ...ordered.map(([key, value]) => [hasOwn(SIZING_LABELS, key) ? SIZING_LABELS[key] : key, formatSizingValue(key, value)] as [string, React.ReactNode]),
  ];

  return (
    <div ref={ref}>
      <Card className="px-6 py-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Sizing detail · master key only</p>
            <h3 className="mt-1 font-serif text-2xl text-ink">{symbol.symbol}</h3>
            <p className="mt-1 text-xs text-secondary">
              {statusMeta(symbol.status).label}{symbol.status_reason ? ` · ${symbol.status_reason}` : ''}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close sizing detail" className="rounded-md p-1.5 text-muted hover:bg-subtle hover:text-ink focus-visible:ring-2 focus-visible:ring-brand">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-[13px] md:grid-cols-3 xl:grid-cols-4">
          {rows.map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="truncate text-[11px] text-muted">{label}</dt>
              <dd className="mt-0.5 truncate tabular-nums text-ink">{value}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </div>
  );
}

/** Today's IST date, kept current past midnight. */
function useIstToday(): string {
  const [today, setToday] = useState(() => istDateKey());
  useEffect(() => {
    const id = setInterval(() => setToday(istDateKey()), CLOCK_TICK_MS);
    return () => clearInterval(id);
  }, []);
  return today;
}

export default function AdminSignalPyramidPage() {
  const today = useIstToday();
  const [date, setDate] = useState(today);
  const [day, setDay] = useState<SignalPyramidDay | null>(null);
  const [dayState, setDayState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  const [days, setDays] = useState<SignalPyramidDayListItem[] | null>(null);
  const [daysFailed, setDaysFailed] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const isToday = date === today;

  // Following "today": when the IST date rolls over, move to the new day.
  const followedToday = useRef(today);
  useEffect(() => {
    if (followedToday.current !== today) {
      setDate((current) => (current === followedToday.current ? today : current));
      followedToday.current = today;
    }
  }, [today]);

  // A new day starts from a blank page; a refresh or poll of the same day keeps what is shown.
  const shownDate = useRef<string | null>(null);

  // The selected day's book; today's is polled.
  useEffect(() => {
    let cancelled = false;
    let busy = false;   // per effect, so a request from the previous date never blocks this one
    if (shownDate.current !== date) {
      shownDate.current = date;
      setDay(null);
      setDayState('loading');
      setSelected(null);
      setRefreshFailed(false);
    }
    const load = () => {
      if (busy) return;
      busy = true;
      adminApi.getSignalPyramidDay(date)
        .then((res) => { if (!cancelled) { setDay(res.data.day); setDayState('ready'); setRefreshFailed(false); } })
        .catch((err) => {
          if (cancelled) return;
          if (err?.response?.status === 404) { setDay(null); setDayState('missing'); setRefreshFailed(false); return; }
          setRefreshFailed(true);
          setDayState((prev) => (prev === 'ready' ? 'ready' : 'error'));
        })
        .finally(() => { busy = false; });
    };
    load();
    const id = isToday ? setInterval(load, TODAY_POLL_MS) : undefined;
    return () => { cancelled = true; if (id) clearInterval(id); };
  }, [date, isToday, retry]);

  // Recent days: polled only while today is open (earlier days do not change).
  useEffect(() => {
    let cancelled = false;
    let busy = false;
    const load = () => {
      if (busy) return;
      busy = true;
      adminApi.listSignalPyramidDays(DAYS_SHOWN)
        .then((res) => { if (!cancelled) { setDays(res.data.days); setDaysFailed(false); } })
        .catch(() => { if (!cancelled) setDaysFailed(true); })
        .finally(() => { busy = false; });
    };
    load();
    const id = isToday ? setInterval(load, TODAY_POLL_MS) : undefined;
    return () => { cancelled = true; if (id) clearInterval(id); };
  }, [retry, isToday]);

  const selectedSymbol = useMemo(() => day?.symbols.find((s) => s.symbol === selected) ?? null, [day, selected]);
  const exp104 = day?.strategy === 'exp104';
  const full = day?.detail === 'full';
  const toggle = (symbol: string) => setSelected((current) => (current === symbol ? null : symbol));

  const columns: Column<SignalPyramidSymbol>[] = [
    {
      id: 'symbol', header: 'Symbol', cell: (s) => (
        <div className="min-w-28">
          {full
            ? <button type="button" onClick={() => toggle(s.symbol)} className="rounded-sm text-left font-semibold text-ink hover:text-brand hover:underline">{s.symbol}</button>
            : <span className="font-semibold text-ink">{s.symbol}</span>}
          <p className="mt-1 text-xs text-muted">Rank {s.rank ?? '—'}</p>
        </div>
      ),
    },
    {
      id: 'status', header: 'Status', cell: (s) => (
        <div className="flex min-w-36 flex-col items-start gap-1">
          <StatusPill tone={statusMeta(s.status).tone}>{statusMeta(s.status).label}</StatusPill>
          {s.status_reason && <span className="max-w-56 text-xs text-muted">{s.status_reason}</span>}
        </div>
      ),
    },
    ...(exp104 ? [{ id: 'group', header: 'Group', cell: (s: SignalPyramidSymbol) => s.group ?? '—' } as Column<SignalPyramidSymbol>] : []),
    { id: 'capital', header: 'Capital given', align: 'right', cell: (s) => <span className={s.capital > 0 ? 'font-semibold text-ink' : 'text-muted'}>{formatMoney(s.capital)}</span> },
    ...(exp104 ? [
      { id: 'qty', header: 'Shares', align: 'right', cell: (s: SignalPyramidSymbol) => formatShares(s.qty) } as Column<SignalPyramidSymbol>,
      { id: 'price', header: '13:00 price', align: 'right', cell: (s: SignalPyramidSymbol) => formatMoney(s.price_1300) } as Column<SignalPyramidSymbol>,
    ] : []),
    ...(exp104 && full ? [{ id: 'score', header: 'Score', align: 'right', cell: (s: SignalPyramidSymbol) => formatNumber(s.score) } as Column<SignalPyramidSymbol>] : []),
    { id: 'morning', header: 'Morning P&L', align: 'right', cell: (s) => <span className={pnlClass(s.total_pnl)}>{formatMoney(s.total_pnl)}</span> },
    ...(full ? [{
      id: 'detail', header: <span className="sr-only">Detail</span>, align: 'right', cell: (s: SignalPyramidSymbol) => (
        <button type="button" onClick={() => toggle(s.symbol)} className="whitespace-nowrap text-xs font-medium text-gain underline underline-offset-2">
          {s.symbol === selected ? 'Hide' : 'Sizing'}
        </button>
      ),
    } as Column<SignalPyramidSymbol>] : []),
  ];

  const dayColumns: Column<SignalPyramidDayListItem>[] = [
    {
      id: 'date', header: 'Day', cell: (d) => (
        <button type="button" onClick={() => setDate(d.date)} className={`whitespace-nowrap rounded-sm text-left font-semibold hover:text-brand hover:underline ${d.date === date ? 'text-brand' : 'text-ink'}`}>{formatDay(d.date)}</button>
      ),
    },
    {
      id: 'outcome', header: 'Outcome', cell: (d) => (
        <div className="flex min-w-40 flex-col items-start gap-1">
          <StatusPill tone={d.live_allowed ? 'ok' : 'attention'}>{d.live_allowed ? `${d.totals.allocated} given capital` : 'Nothing published'}</StatusPill>
          {!d.live_allowed && <span className="text-xs text-muted">{reasonLabel(d.reason)}</span>}
        </div>
      ),
    },
    {
      id: 'names', header: 'Symbols given capital', cell: (d) => d.allocated_symbols.length ? (
        <div className="flex max-w-md flex-wrap gap-1.5">
          {d.allocated_symbols.map((s) => (
            <span key={s.symbol} title={s.status === 'not_opened' ? 'Given capital but not opened at 13:00' : undefined}
              className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ${s.status === 'live' ? 'bg-gain-soft text-gain ring-gain/25' : 'bg-attention-soft text-attention ring-attention/25'}`}>
              {s.symbol} · {formatLakh(s.capital)}{s.qty != null ? ` · ${s.qty} sh` : ''}
            </span>
          ))}
        </div>
      ) : <span className="text-muted">—</span>,
    },
    { id: 'capital', header: 'Capital given', align: 'right', cell: (d) => <span className="font-semibold text-ink">{formatMoney(d.totals.allocated_capital)}</span> },
    { id: 'account', header: 'Account', align: 'right', cell: (d) => formatMoney(d.account) },
  ];

  const missing = missingMessage(date, today);

  return (
    <div className="page-stack">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-muted">Signal service · 13:00 handoff</p>
          <h2 className="mt-1 font-serif text-3xl text-ink">Capital pyramid</h2>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label htmlFor="pyramid-date" className="block text-[11px] font-medium text-muted">Day</label>
            <input id="pyramid-date" type="date" value={date} min={MIN_DATE} max={today}
              onChange={(e) => { const v = e.target.value; if (v && v >= MIN_DATE && v <= today) setDate(v); }}
              className={`${inputClass} mt-1`} />
          </div>
          {!isToday && <button type="button" onClick={() => setDate(today)} className={`${secondaryButtonClass} mb-0.5`}>Today</button>}
          <button type="button" onClick={() => setRetry((n) => n + 1)} className={`${secondaryButtonClass} mb-0.5`} aria-label="Refresh">
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Refresh
          </button>
        </div>
      </div>

      {dayState === 'loading' && <div className="flex justify-center py-10"><Spinner className="h-5 w-5 text-muted" /></div>}

      {dayState === 'missing' && <EmptyState title={missing.title} body={missing.body} />}

      {dayState === 'error' && <LoadError title="Could not load the pyramid" onRetry={() => setRetry((n) => n + 1)} />}

      {dayState === 'ready' && day && day.totals.evaluated === 0 && (
        <EmptyState
          title={`Nothing published on ${formatDay(day.date)}`}
          body={`${reasonLabel(day.reason)}${day.recorded_at ? ` · recorded ${formatDateTime(day.recorded_at)}` : ''}`}
        />
      )}

      {dayState === 'ready' && day && day.totals.evaluated > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-2 text-xs text-secondary">
            <StatusPill tone={day.live_allowed ? 'ok' : 'attention'}>{day.live_allowed ? 'Published' : 'Nothing published'}</StatusPill>
            {!day.live_allowed && <span>{reasonLabel(day.reason)}</span>}
            <span>· {strategyLabel(day.strategy)}</span>
            {day.recorded_at && <span>· recorded {formatDateTime(day.recorded_at)}</span>}
            {refreshFailed
              ? <span className="flex items-center gap-1 text-attention">· <WifiOff className="h-3 w-3" aria-hidden="true" /> Reconnecting · values may be out of date</span>
              : isToday && <span className="flex items-center gap-1">· <RefreshCw className="h-3 w-3" aria-hidden="true" /> updates every 30 seconds</span>}
          </div>

          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <StatTile label="Capital given" value={formatMoney(day.totals.allocated_capital)} delta={`${day.totals.allocated} of ${day.totals.evaluated} symbols`} />
            <StatTile
              label="Opened at 13:00"
              value={formatMoney(day.totals.live_capital)}
              delta={day.totals.not_opened ? <span className="text-attention">{day.totals.not_opened} given capital but not opened</span> : `${day.totals.live} symbols trading`}
            />
            <StatTile
              label="Account"
              value={formatMoney(day.account)}
              delta={[
                day.account_scale != null ? `Scale ×${formatNumber(day.account_scale, 3)}` : null,
                day.account && day.totals.allocated_capital ? `${formatNumber(day.totals.allocated_capital / day.account, 2)}× account` : null,
              ].filter(Boolean).join(' · ') || undefined}
            />
            <StatTile
              label="Dropped"
              value={day.totals.dropped}
              delta={exp104 ? 'Not PROFIT, no pyramid share, or exited' : day.strategy === 'threshold' ? 'Below their profit threshold, or exited' : 'Not given capital'}
            />
          </div>

          <DataTable
            caption={`Pyramid book for ${day.date}`}
            columns={columns}
            rows={day.symbols}
            rowKey={(s) => s.symbol}
            isProblem={(s) => s.status === 'not_opened'}
            emptyTitle="No symbols were evaluated"
            minWidth={exp104 ? 960 : 720}
          />

          {full && selectedSymbol && <SymbolDetail symbol={selectedSymbol} onClose={() => setSelected(null)} />}
        </>
      )}

      <div className="page-stack">
        <div className="flex items-end justify-between gap-3">
          <h3 className="font-serif text-xl text-ink">Recent days</h3>
          {daysFailed && days && <p className="flex items-center gap-2 text-xs text-muted"><WifiOff className="h-3.5 w-3.5 text-attention" /> Reconnecting · may be out of date</p>}
        </div>
        {daysFailed && !days
          ? <LoadError title="Could not load recent days" onRetry={() => setRetry((n) => n + 1)} />
          : (
            <DataTable
              caption="Recent pyramid days"
              columns={dayColumns}
              rows={days ?? []}
              rowKey={(d) => d.date}
              loading={!days}
              emptyTitle="No pyramid days yet"
              emptyDescription="Days appear once the signal service has run its 13:00 handoff."
              minWidth={900}
            />
          )}
      </div>
    </div>
  );
}
