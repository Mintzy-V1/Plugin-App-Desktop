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

/** True when the log timestamp falls on 13:00 IST. */
export function isOnePmIstLog(timeMs: number | null | undefined): boolean {
  if (timeMs == null) return false;
  const hm = istHourMinute(timeMs);
  return hm != null && hm.hour === 13 && hm.minute === 0;
}

/** True when the log timestamp falls on 12:59 IST (sim close / pyramid snapshot). */
export function isSimCloseIstLog(timeMs: number | null | undefined): boolean {
  if (timeMs == null) return false;
  const hm = istHourMinute(timeMs);
  return hm != null && hm.hour === 12 && hm.minute === 59;
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

/** Fallback: 13:00 IST snapshot from `/trading/live-pnl/:id/history`. */
export function extractOnePmPnlFromHistory(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!raw || typeof raw !== 'object') return out;

  const root = raw as Record<string, unknown>;
  const snapshots = Array.isArray(root.snapshots) ? root.snapshots : [];

  for (const item of snapshots) {
    if (!item || typeof item !== 'object') continue;
    const snap = item as Record<string, unknown>;
    const data = (snap.data && typeof snap.data === 'object' ? snap.data : snap) as Record<string, unknown>;
    const ts = parseInstantMs(data.ts) ?? parseInstantMs(snap.source_ts) ?? parseInstantMs(snap.sampled_at);
    if (ts == null || !isOnePmIstLog(ts)) continue;

    const map = parsePyramidPnlBySymbol({ symbols: data.symbols ?? data });
    if (Object.keys(map).length > 0) return map;
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

