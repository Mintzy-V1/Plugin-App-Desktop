import { formatIstDayLabel, formatIstMonthLabel, istDateKey, istNowParts } from './istClock';
import type { SessionTrade } from './sessionTrades';

export interface NamedAmount {
  label: string;
  value: number;
}

export interface MonthReturn {
  year: number;
  month: number;
  key: string;
  label: string;
  pnl: number | null;
}

export interface PerformanceStats {
  maxProfitScript: NamedAmount | null;
  maxLosingScript: NamedAmount | null;
  maxProfitDay: NamedAmount | null;
  maxLosingDay: NamedAmount | null;
  avgWinRate: number | null;
  maxDrawdownPct: number | null;
  avgRiskReward: number | null;
  overallReturnPct: number | null;
  totalPnl: number;
  startCapital: number | null;
  maxWinStreak: number;
  maxLoseStreak: number;
  months: MonthReturn[];
  tradingDays: number;
  asOfDate: string;
}

const CACHE_PREFIX = 'mintzy.perfStats.v1.';

interface CacheRecord {
  asOfDate: string;
  fingerprint: string;
  computedAt: number;
  stats: PerformanceStats;
}

function cacheKey(userId: string) {
  return `${CACHE_PREFIX}${userId}`;
}

export function readCachedStats(userId: string): CacheRecord | null {
  try {
    const raw = localStorage.getItem(cacheKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheRecord;
    if (!parsed?.stats || !parsed.asOfDate) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeCachedStats(userId: string, record: CacheRecord): void {
  try {
    localStorage.setItem(cacheKey(userId), JSON.stringify(record));
  } catch { /* quota */ }
}

function last12Months(now = new Date()): Array<{ year: number; month: number; key: string; label: string }> {
  const { year, month } = istNowParts(now);
  const out: Array<{ year: number; month: number; key: string; label: string }> = [];
  let y = year;
  let m = month;
  for (let i = 0; i < 12; i++) {
    out.unshift({
      year: y,
      month: m,
      key: `${y}-${String(m).padStart(2, '0')}`,
      label: formatIstMonthLabel(y, m),
    });
    m -= 1;
    if (m < 1) {
      m = 12;
      y -= 1;
    }
  }
  return out;
}

function streak(values: number[]): { win: number; lose: number } {
  let maxWin = 0;
  let maxLose = 0;
  let curWin = 0;
  let curLose = 0;
  for (const v of values) {
    if (v > 0) {
      curWin += 1;
      curLose = 0;
      if (curWin > maxWin) maxWin = curWin;
    } else if (v < 0) {
      curLose += 1;
      curWin = 0;
      if (curLose > maxLose) maxLose = curLose;
    } else {
      curWin = 0;
      curLose = 0;
    }
  }
  return { win: maxWin, lose: maxLose };
}

export function computePerformanceStats(trades: SessionTrade[], now = new Date()): PerformanceStats {
  const asOfDate = istDateKey(now);
  const empty: PerformanceStats = {
    maxProfitScript: null,
    maxLosingScript: null,
    maxProfitDay: null,
    maxLosingDay: null,
    avgWinRate: null,
    maxDrawdownPct: null,
    avgRiskReward: null,
    overallReturnPct: null,
    totalPnl: 0,
    startCapital: null,
    maxWinStreak: 0,
    maxLoseStreak: 0,
    months: last12Months(now).map((m) => ({ ...m, pnl: null })),
    tradingDays: 0,
    asOfDate,
  };

  const usable = trades
    .filter((t) => !t.wait && Number.isFinite(t.pnl) && t.symbol)
    .sort((a, b) => a.timeMs - b.timeMs);
  if (usable.length === 0) return empty;

  // Last snapshot per session / symbol / IST day (P&L in logs is cumulative, not incremental).
  const scriptDay = new Map<string, SessionTrade>();
  for (const t of usable) {
    scriptDay.set(`${t.sessionId}|${t.dateKey}|${t.symbol}`, t);
  }
  const dayEnds = Array.from(scriptDay.values());

  const byScript = new Map<string, number>();
  const byDay = new Map<string, number>();
  for (const t of dayEnds) {
    byScript.set(t.symbol, (byScript.get(t.symbol) ?? 0) + t.pnl);
    byDay.set(t.dateKey, (byDay.get(t.dateKey) ?? 0) + t.pnl);
  }

  const scriptEntries = Array.from(byScript.entries());
  const dayEntries = Array.from(byDay.entries()).sort(([a], [b]) => a.localeCompare(b));
  const dailyValues = dayEntries.map(([, v]) => v);

  const bestScript = scriptEntries.reduce((best, cur) => (!best || cur[1] > best[1] ? cur : best), null as [string, number] | null);
  const worstScript = scriptEntries.reduce((best, cur) => (!best || cur[1] < best[1] ? cur : best), null as [string, number] | null);
  const bestDay = dayEntries.reduce((best, cur) => (!best || cur[1] > best[1] ? cur : best), null as [string, number] | null);
  const worstDay = dayEntries.reduce((best, cur) => (!best || cur[1] < best[1] ? cur : best), null as [string, number] | null);

  const wins = dailyValues.filter((v) => v > 0).length;
  const tradedDays = dailyValues.filter((v) => v !== 0).length;
  const avgWinRate = tradedDays > 0 ? (wins / tradedDays) * 100 : null;

  const positive = dailyValues.filter((v) => v > 0);
  const negative = dailyValues.filter((v) => v < 0).map((v) => Math.abs(v));
  const avgWin = positive.length ? positive.reduce((a, b) => a + b, 0) / positive.length : 0;
  const avgLoss = negative.length ? negative.reduce((a, b) => a + b, 0) / negative.length : 0;
  const avgRiskReward = avgLoss > 0 ? avgWin / avgLoss : null;

  const startCapital = usable.find((t) => t.capital != null && t.capital > 0)?.capital ?? null;
  const totalPnl = dailyValues.reduce((a, b) => a + b, 0);
  const overallReturnPct = startCapital && startCapital > 0 ? (totalPnl / startCapital) * 100 : null;

  const base = startCapital && startCapital > 0 ? startCapital : 0;
  let peak = base;
  let equity = base;
  let maxDd = 0;
  for (const v of dailyValues) {
    equity += v;
    if (equity > peak) peak = equity;
    if (peak > 0) {
      const dd = ((peak - equity) / peak) * 100;
      if (dd > maxDd) maxDd = dd;
    }
  }

  const { win, lose } = streak(dailyValues);

  const monthPnl = new Map<string, number>();
  const monthHasTrade = new Set<string>();
  for (const [dateKey, pnl] of dayEntries) {
    const mk = dateKey.slice(0, 7);
    monthPnl.set(mk, (monthPnl.get(mk) ?? 0) + pnl);
    monthHasTrade.add(mk);
  }

  const months = last12Months(now).map((m) => ({
    ...m,
    pnl: monthHasTrade.has(m.key) ? (monthPnl.get(m.key) ?? 0) : null,
  }));

  return {
    maxProfitScript: bestScript ? { label: bestScript[0], value: bestScript[1] } : null,
    maxLosingScript: worstScript ? { label: worstScript[0], value: worstScript[1] } : null,
    maxProfitDay: bestDay ? { label: formatIstDayLabel(bestDay[0]), value: bestDay[1] } : null,
    maxLosingDay: worstDay ? { label: formatIstDayLabel(worstDay[0]), value: worstDay[1] } : null,
    avgWinRate,
    maxDrawdownPct: dailyValues.length ? maxDd : null,
    avgRiskReward,
    overallReturnPct,
    totalPnl,
    startCapital,
    maxWinStreak: win,
    maxLoseStreak: lose,
    months,
    tradingDays: dayEntries.length,
    asOfDate,
  };
}
