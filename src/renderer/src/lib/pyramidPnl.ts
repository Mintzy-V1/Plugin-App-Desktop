const IST = 'Asia/Kolkata';

function parseInstantMs(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    if (raw <= 0) return null;
    return raw < 1e12 ? Math.round(raw * 1000) : Math.round(raw);
  }
  if (typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    return parseInstantMs(o.$date ?? o.$numberLong ?? o.$numberInt);
  }
  const s = String(raw).trim();
  if (!s) return null;
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(s)) {
    const ms = Date.parse(s);
    return Number.isNaN(ms) ? null : ms;
  }
  const normalized = s.includes('T') ? s : s.replace(' ', 'T');
  const ms = Date.parse(`${normalized}+05:30`);
  if (!Number.isNaN(ms)) return ms;
  const fallback = Date.parse(normalized);
  return Number.isNaN(fallback) ? null : fallback;
}

function istHourMinute(timeMs: number): { hour: number; minute: number } | null {
  if (!Number.isFinite(timeMs)) return null;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: IST,
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(new Date(timeMs));
  const hour = Number(parts.find((p) => p.type === 'hour')?.value);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return { hour, minute };
}

/** True when the log timestamp falls on 11:45 IST (last morning sim candle). */
export function isLastMorningSimIstLog(timeMs: number | null | undefined): boolean {
  if (timeMs == null) return false;
  const hm = istHourMinute(timeMs);
  return hm != null && hm.hour === 11 && hm.minute === 45;
}

/** True when the log timestamp falls on 12:59 IST (sim close / pyramid snapshot). */
export function isSimCloseIstLog(timeMs: number | null | undefined): boolean {
  if (timeMs == null) return false;
  const hm = istHourMinute(timeMs);
  return hm != null && hm.hour === 12 && hm.minute === 59;
}

/**
 * Session square-off snapshot: engine logs this at 14:50 or 15:00 IST
 * (a few seconds of lag can push the stamp into the next minute).
 */
export function isSessionSquareOffIstLog(timeMs: number | null | undefined): boolean {
  if (timeMs == null) return false;
  const hm = istHourMinute(timeMs);
  if (!hm) return false;
  if (hm.hour === 14 && hm.minute >= 50 && hm.minute <= 52) return true;
  if (hm.hour === 15 && hm.minute <= 2) return true;
  return false;
}

/** Same IST calendar day as `timeMs`, at hour:minute:second. */
export function istWallClockMs(timeMs: number, hour: number, minute: number, second = 0): number {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: IST,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(timeMs));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value;
  const y = get('year');
  const m = get('month');
  const d = get('day');
  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  const ss = String(second).padStart(2, '0');
  return Date.parse(`${y}-${m}-${d}T${hh}:${mm}:${ss}+05:30`);
}

function num(v: unknown): number | null {
  if (v == null || v === '' || v === '-') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function readSymbolUnrealized(row: Record<string, unknown>): number | null {
  return num(
    row.unrealized_pnl
    ?? row.unrealised_pnl
    ?? row.symbol_unrealized_pnl
    ?? row.symbol_unrealised_pnl
    ?? row.symbol_pnl
    ?? row.live_unrealized_pnl
    ?? row.total_pnl
    ?? row.pnl,
  );
}

function readMarkFromObject(row: Record<string, unknown>, allowGenericPrice = false): number | null {
  const n = num(
    row.ltp
    ?? row.LTP
    ?? row.last_traded_price
    ?? row.lastTradedPrice
    ?? row.last_price
    ?? row.lastPrice
    ?? row.curr_price
    ?? row.current_price
    ?? row.mark_price
    ?? row.mark
    ?? row.ltp_price
    ?? row.last
    ?? (allowGenericPrice ? row.price : undefined),
  );
  return n != null && n !== 0 ? n : null;
}

/** Mark/LTP at the pyramid snapshot — not entry and not the previous candle close. */
function readSymbolMarkPrice(row: Record<string, unknown>, allowGenericPrice = false): number | null {
  const nested = [row, row.tick, row.quote, row.market, row.ohlc, row.data];
  for (const item of nested) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const n = readMarkFromObject(item as Record<string, unknown>, allowGenericPrice);
    if (n != null) return n;
  }
  return null;
}

function looksLikeTicker(key: string): boolean {
  return /^[A-Z][A-Z0-9.&-]{1,19}$/.test(key);
}

function ingestSymbolRow(out: Record<string, number>, sym: string, row: unknown): void {
  const key = String(sym || '').toUpperCase().trim();
  if (!key || key === '-') return;
  if (typeof row === 'number') {
    out[key] = row;
    return;
  }
  if (!row || typeof row !== 'object') return;
  const pnl = readSymbolUnrealized(row as Record<string, unknown>);
  if (pnl != null) out[key] = pnl;
}

function ingestSymbolPrice(out: Record<string, number>, sym: string, row: unknown, allowGenericPrice = false): void {
  const key = String(sym || '').toUpperCase().trim();
  if (!key || key === '-' || !row || typeof row !== 'object') return;
  const price = readSymbolMarkPrice(row as Record<string, unknown>, allowGenericPrice);
  if (price != null) out[key] = price;
}

function ingestPriceMap(out: Record<string, number>, map: unknown, allowGenericPrice = false): void {
  if (!map || typeof map !== 'object') return;
  if (Array.isArray(map)) {
    for (const item of map) {
      if (!item || typeof item !== 'object') continue;
      const row = item as Record<string, unknown>;
      ingestSymbolPrice(out, String(row.symbol ?? row.Symbol ?? ''), row, allowGenericPrice);
    }
    return;
  }
  for (const [sym, row] of Object.entries(map as Record<string, unknown>)) {
    ingestSymbolPrice(out, sym, row, allowGenericPrice);
  }
}

function ingestSymbolMap(out: Record<string, number>, map: unknown): void {
  if (!map || typeof map !== 'object' || Array.isArray(map)) return;
  for (const [sym, row] of Object.entries(map as Record<string, unknown>)) {
    ingestSymbolRow(out, sym, row);
  }
}

function ingestRowsArray(out: Record<string, number>, rows: unknown): void {
  if (!Array.isArray(rows)) return;
  for (const item of rows) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    ingestSymbolRow(out, String(row.symbol ?? row.Symbol ?? ''), row);
  }
}

/** Parse `/trading/pyramid-pnl/:sessionId` into per-symbol unrealized P&L. */
export function parsePyramidPnlBySymbol(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!raw || typeof raw !== 'object') return out;

  const root = raw as Record<string, unknown>;
  if (root.success === false) return out;

  const payload = (root.data && typeof root.data === 'object' ? root.data : root) as Record<string, unknown>;
  const nested = (payload.pyramid_pnl && typeof payload.pyramid_pnl === 'object'
    ? payload.pyramid_pnl
    : payload.pyramid) as Record<string, unknown> | undefined;

  const symbolPayload = payload.symbols ?? root.symbols ?? nested?.symbols;
  ingestSymbolMap(out, symbolPayload);
  ingestRowsArray(out, symbolPayload);
  ingestRowsArray(out, payload.rows ?? payload.logs ?? payload.trades ?? payload.entries ?? root.rows);

  if (Object.keys(out).length === 0) {
    for (const [key, value] of Object.entries(payload)) {
      if (key === 'success' || key === 'session_id' || key === 'market_date') continue;
      if (looksLikeTicker(key)) ingestSymbolRow(out, key, value);
    }
  }

  if (Object.keys(out).length === 0 && nested) {
    ingestSymbolMap(out, nested);
    for (const [key, value] of Object.entries(nested)) {
      if (looksLikeTicker(key)) ingestSymbolRow(out, key, value);
    }
  }

  return out;
}

/** Per-symbol LTP/mark from `/trading/pyramid-pnl/:sessionId` (12:59 snapshot). */
export function parsePyramidPriceBySymbol(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!raw || typeof raw !== 'object') return out;

  const root = raw as Record<string, unknown>;
  if (root.success === false) return out;

  const payload = (root.data && typeof root.data === 'object' ? root.data : root) as Record<string, unknown>;
  const nested = (payload.pyramid_pnl && typeof payload.pyramid_pnl === 'object'
    ? payload.pyramid_pnl
    : payload.pyramid) as Record<string, unknown> | undefined;

  const symbolPayload = payload.symbols ?? root.symbols ?? nested?.symbols;
  ingestPriceMap(out, symbolPayload);
  ingestPriceMap(out, payload.rows ?? payload.logs ?? payload.trades ?? payload.entries ?? root.rows);

  if (Object.keys(out).length === 0) {
    for (const [key, value] of Object.entries(payload)) {
      if (key === 'success' || key === 'session_id' || key === 'market_date') continue;
      if (looksLikeTicker(key)) ingestSymbolPrice(out, key, value);
    }
  }

  if (Object.keys(out).length === 0 && nested) {
    ingestPriceMap(out, nested);
    for (const [key, value] of Object.entries(nested)) {
      if (looksLikeTicker(key)) ingestSymbolPrice(out, key, value);
    }
  }

  return out;
}

/** 12:50–13:02 IST, the window that holds the 12:59 sim-close mark. */
export function isSimClosePriceWindow(timeMs: number): boolean {
  const hm = istHourMinute(timeMs);
  if (!hm) return false;
  if (hm.hour === 12 && hm.minute >= 50) return true;
  if (hm.hour === 13 && hm.minute <= 2) return true;
  return false;
}

function pricesFromHistorySymbols(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  ingestPriceMap(out, raw, true);
  return out;
}

/**
 * Handoff LTP from `/trading/live-pnl/:id/history`.
 * Simulation snapshots are no longer in this feed, so the sample nearest
 * 12:59 inside 12:50–13:02 IST is the live-open mark.
 */
export function extractSimClosePricesFromHistory(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  const bestTs: Record<string, number> = {};
  if (!raw || typeof raw !== 'object') return out;
  const root = raw as Record<string, unknown>;
  const snapshots = Array.isArray(root.snapshots) ? root.snapshots : [];

  for (const item of snapshots) {
    if (!item || typeof item !== 'object') continue;
    const snap = item as Record<string, unknown>;
    const data = (snap.data && typeof snap.data === 'object' ? snap.data : snap) as Record<string, unknown>;
    const ts = parseInstantMs(data.ts) ?? parseInstantMs(snap.source_ts) ?? parseInstantMs(snap.sampled_at);
    if (ts == null || !isSimClosePriceWindow(ts)) continue;
    const map = pricesFromHistorySymbols(data.symbols ?? data);
    const target = istWallClockMs(ts, 12, 59, 0);
    for (const [sym, price] of Object.entries(map)) {
      const prev = bestTs[sym];
      if (prev == null || Math.abs(ts - target) <= Math.abs(prev - target)) {
        bestTs[sym] = ts;
        out[sym] = price;
      }
    }
  }

  return out;
}

export function mergePyramidMaps(...maps: Array<Record<string, number> | null | undefined>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const map of maps) {
    if (!map) continue;
    for (const [sym, pnl] of Object.entries(map)) {
      if (Number.isFinite(pnl)) out[sym] = pnl;
    }
  }
  return out;
}

