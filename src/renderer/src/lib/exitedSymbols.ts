export interface ExitedSymbol {
  symbol: string;
  exit_reason?: string;
  exit_time?: string;
  exit_time_utc?: string;
  qty?: number;
  entry_price?: number;
  exit_price?: number;
  total_pnl?: number;
  unrealized_pnl?: number;
  realized_pnl?: number;
  entry_side?: string;
  exit_side?: string;
  position_status?: string;
  status?: string;
  display_cycle?: number;
  exit_actual_cycle?: number;
}

function num(v: unknown): number | null {
  if (v == null || v === '' || v === '-') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function str(v: unknown): string {
  return v == null ? '' : String(v).trim();
}

export function parseExitedSymbols(raw: unknown): ExitedSymbol[] {
  if (!raw || typeof raw !== 'object') return [];
  const o = raw as Record<string, unknown>;
  const list = o.symbols ?? o.data ?? o.exited ?? o.exited_symbols;
  if (!Array.isArray(list)) return [];
  const out: ExitedSymbol[] = [];
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const symbol = str(row.symbol ?? row.Symbol).toUpperCase();
    if (!symbol) continue;
    out.push({
      symbol,
      exit_reason: str(row.exit_reason ?? row.exitReason) || undefined,
      exit_time: str(row.exit_time ?? row.exitTime) || undefined,
      exit_time_utc: str(row.exit_time_utc ?? row.exitTimeUtc) || undefined,
      qty: num(row.qty ?? row.quantity) ?? undefined,
      entry_price: num(row.entry_price ?? row.entryPrice) ?? undefined,
      exit_price: num(row.exit_price ?? row.exitPrice) ?? undefined,
      total_pnl: num(row.total_pnl ?? row.totalPnl) ?? undefined,
      unrealized_pnl: num(row.unrealized_pnl ?? row.unrealizedPnl) ?? undefined,
      realized_pnl: num(row.realized_pnl ?? row.realizedPnl) ?? undefined,
      entry_side: str(row.entry_side ?? row.entrySide) || undefined,
      exit_side: str(row.exit_side ?? row.exitSide) || undefined,
      position_status: str(row.position_status ?? row.positionStatus) || undefined,
      status: str(row.status) || undefined,
      display_cycle: num(row.display_cycle) ?? undefined,
      exit_actual_cycle: num(row.exit_actual_cycle) ?? undefined,
    });
  }
  return out;
}

export function exitedSymbolPnl(ex: ExitedSymbol): number | null {
  return num(ex.total_pnl) ?? num(ex.unrealized_pnl) ?? num(ex.realized_pnl);
}

export function exitedSymbolTimeRaw(ex: ExitedSymbol): string | undefined {
  return ex.exit_time_utc || ex.exit_time;
}

/** True when this exit falls after `fromMs` and at or before `toMs`. */
export function rmsHitInWindow(
  exits: ExitedSymbol[],
  symbol: string,
  fromMs: number,
  toMs: number,
  parseMs: (raw: unknown) => number | null,
): ExitedSymbol | null {
  const key = symbol.toUpperCase();
  let best: ExitedSymbol | null = null;
  let bestMs = Number.NEGATIVE_INFINITY;
  for (const ex of exits) {
    if (ex.symbol.toUpperCase() !== key) continue;
    const ms = parseMs(exitedSymbolTimeRaw(ex));
    if (ms == null) {
      if (!best) best = ex;
      continue;
    }
    if (ms <= fromMs || ms > toMs) continue;
    if (ms >= bestMs) {
      best = ex;
      bestMs = ms;
    }
  }
  return best;
}
