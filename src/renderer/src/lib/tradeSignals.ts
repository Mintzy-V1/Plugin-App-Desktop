export type ActionTone =
  | 'buy'
  | 'sell'
  | 'sent'
  | 'wait'
  | 'hold-long'
  | 'hold-short'
  | 'hold'
  | 'filled'
  | 'close'
  | 'neutral';

const TONE_CLASS: Record<ActionTone, string> = {
  buy: 'bg-emerald-50 text-emerald-800 ring-emerald-100',
  sell: 'bg-rose-50 text-rose-800 ring-rose-100',
  sent: 'bg-sky-50 text-sky-800 ring-sky-100',
  wait: 'bg-slate-100 text-slate-600 ring-slate-200/80',
  'hold-long': 'bg-amber-50 text-amber-800 ring-amber-100',
  'hold-short': 'bg-violet-50 text-violet-800 ring-violet-100',
  hold: 'bg-amber-50 text-amber-800 ring-amber-100',
  filled: 'bg-emerald-50 text-emerald-800 ring-emerald-100',
  close: 'bg-slate-800 text-white ring-slate-800',
  neutral: 'bg-slate-100 text-slate-600 ring-slate-200/80',
};

function normalizeKey(raw: string): string {
  return String(raw || '')
    .toLowerCase()
    .replace(/[_()/[\],]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function formatTradeLabel(raw: string | number | null | undefined): { label: string; tone: ActionTone } {
  const original = String(raw ?? '').trim();
  if (!original || original === '-' || original === '—') {
    return { label: '—', tone: 'neutral' };
  }

  const n = normalizeKey(original);

  if (n === 'buy' || n === 'long' || n.startsWith('buy ')) {
    return { label: 'Buy', tone: 'buy' };
  }
  if (n === 'sell' || n === 'short' || n.startsWith('sell ')) {
    return { label: 'Sell', tone: 'sell' };
  }

  if (/pending/.test(n) || /order sent/.test(n)) {
    return { label: 'Order Sent', tone: 'sent' };
  }
  if (/wait/.test(n) || /no position/.test(n) || /no momentum/.test(n) || n === 'flat') {
    return { label: 'No momentum', tone: 'wait' };
  }
  if (/hold/.test(n) && /short/.test(n)) {
    return { label: 'Hold (Continue Short)', tone: 'hold-short' };
  }
  if (/hold/.test(n) && /long/.test(n)) {
    return { label: 'Hold (Continue Long)', tone: 'hold-long' };
  }
  if (/^hold/.test(n)) {
    return { label: 'Hold', tone: 'hold' };
  }

  if (/close long|exit long/.test(n)) return { label: 'Close Long', tone: 'close' };
  if (/close short|cover short|exit short/.test(n)) return { label: 'Close Short', tone: 'close' };
  if (/^close|^exit|^cover/.test(n)) return { label: 'Closed', tone: 'close' };

  if (/rms/.test(n)) return { label: 'Hit RMS', tone: 'sell' };

  if (n === 'filled' || n === 'complete' || n === 'executed') {
    return { label: 'Filled', tone: 'filled' };
  }

  const pretty = original
    .replace(/[_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return { label: pretty || original, tone: 'neutral' };
}

export function isWaitAction(raw: string | number | null | undefined): boolean {
  return formatTradeLabel(raw).tone === 'wait';
}

export function actionPillClass(tone: ActionTone): string {
  return `inline-flex max-w-[11.5rem] items-center truncate rounded-full px-2 py-0.5 text-[11px] font-semibold leading-4 ring-1 ${TONE_CLASS[tone]}`;
}
