/**
 * EXP104 13:00 lockout. A stock the engine locks at 13:00 (for example, no momentum)
 * gets one LOCKED OUT row in the trade log and no more cycles that day. The gateway also
 * sends `locked_out_symbols: [{symbol, reason, message}]` on the full session state.
 */

export interface LockedOutSymbol {
  symbol: string;
  reason: string;
  message: string;
}

const REASON_TEXT: Record<string, string> = {
  NO_MOMENTUM: 'no momentum at 13:00',
  ZERO_TRAJECTORY: 'zero trajectory at 13:00',
  NO_PREDICTION: 'no usable 13:00 prediction',
  NO_PRICE: 'no 13:00 price',
  NO_SHARES: 'the 13:00 trajectory left no whole shares to buy',
  NOT_PROFIT: "not in today's PROFIT book",
  NOT_IN_BOOK: "not in today's book",
  MISSED_1300: 'the session missed the 13:00 gate',
  GATE_ERROR: 'the 13:00 gate could not run',
  NO_ENTRY: 'no entry at 13:00',
};

export function lockReasonText(reason: string | null | undefined): string {
  const key = String(reason || '').toUpperCase();
  return REASON_TEXT[key] ?? (key ? key.toLowerCase().replace(/_/g, ' ') : 'locked at 13:00');
}

function cleanSymbol(raw: unknown): string {
  return String(raw ?? '').toUpperCase().replace(/-EQ$/, '').trim();
}

export function lockMessageFor(symbol: string, reason: string | null | undefined): string {
  return `${cleanSymbol(symbol)} is locked out for today's session: ${lockReasonText(reason)}. No trades for the rest of the day.`;
}

/** The gateway's `locked_out_symbols` list; [] when absent or malformed. */
export function parseLockedOutSymbols(raw: unknown): LockedOutSymbol[] {
  if (!Array.isArray(raw)) return [];
  const out: LockedOutSymbol[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const symbol = cleanSymbol(o.symbol);
    if (!symbol) continue;
    const reason = String(o.reason ?? o.lock_reason ?? '').toUpperCase();
    const message = String(o.message ?? o.lock_message ?? '').trim() || lockMessageFor(symbol, reason);
    out.push({ symbol, reason, message });
  }
  return out;
}

/** True for a trade-log record the engine wrote as a 13:00 lockout row. */
export function isLockedOutRecord(r: Record<string, unknown>): boolean {
  const flag = r.locked_out ?? r.lockedOut;
  if (flag === true || flag === 'true' || flag === 1) return true;
  const action = String(r.action ?? r.Action ?? r.Action_Status ?? '');
  return /^locked out/i.test(action.trim());
}

/** The banner's list: the gateway list when it has one, else the log's locked rows. */
export function resolveLockedOut(
  fromGateway: LockedOutSymbol[],
  rows: Array<{ symbol: string; lockedOut?: boolean; lockReason?: string; lockMessage?: string; timeMs: number | null }>,
): LockedOutSymbol[] {
  if (fromGateway.length > 0) return fromGateway;
  const locked = rows.filter((r) => r.lockedOut);
  if (locked.length === 0) return [];
  // Only the latest trading day's locks (IST date of the row)
  const dayOf = (ms: number | null) => (ms == null ? '' : new Date(ms + 5.5 * 3600 * 1000).toISOString().slice(0, 10));
  const latest = locked.reduce((d, r) => (dayOf(r.timeMs) > d ? dayOf(r.timeMs) : d), '');
  const bySymbol = new Map<string, LockedOutSymbol>();
  for (const r of locked) {
    if (dayOf(r.timeMs) !== latest) continue;
    const symbol = cleanSymbol(r.symbol);
    if (!symbol || bySymbol.has(symbol)) continue;
    const reason = String(r.lockReason || '').toUpperCase();
    bySymbol.set(symbol, { symbol, reason, message: r.lockMessage || lockMessageFor(symbol, reason) });
  }
  return Array.from(bySymbol.values()).sort((a, b) => a.symbol.localeCompare(b.symbol));
}
