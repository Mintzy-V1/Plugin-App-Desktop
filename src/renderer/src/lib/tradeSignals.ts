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
  | 'exit'
  | 'locked'
  | 'neutral';

const TONE_CLASS: Record<ActionTone, string> = {
  buy: 'bg-gain-soft text-gain ring-gain/25',
  sell: 'bg-loss-soft text-loss ring-loss/25',
  sent: 'bg-info-soft text-info ring-brand/25',
  wait: 'bg-subtle text-secondary ring-brand/80',
  'hold-long': 'bg-attention-soft text-attention ring-attention/25',
  'hold-short': 'bg-info-soft text-info ring-brand/25',
  hold: 'bg-attention-soft text-attention ring-attention/25',
  filled: 'bg-gain-soft text-gain ring-gain/25',
  close: 'bg-primary text-on-primary ring-brand',
  exit: 'bg-info-soft text-info ring-brand/25',
  locked: 'bg-attention-soft text-attention ring-attention/25',
  neutral: 'bg-subtle text-secondary ring-brand/80',
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
  // EXP104 13:00 lockout: checked before WAIT, since its text says "no momentum" too
  if (/^locked out/.test(n)) {
    return { label: 'Locked out', tone: 'locked' };
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

  if (/manual exit/.test(n)) return { label: 'EXIT/MANUAL EXIT', tone: 'exit' };
  if (/close long|exit long/.test(n)) return { label: 'Close Long', tone: 'close' };
  if (/close short|cover short|exit short/.test(n)) return { label: 'Close Short', tone: 'close' };
  if (n === 'exit') return { label: 'Exit', tone: 'exit' };
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

/** No position on this row: a WAIT, or a stock locked out at 13:00. Its qty stays empty. */
export function isWaitAction(raw: string | number | null | undefined): boolean {
  const tone = formatTradeLabel(raw).tone;
  return tone === 'wait' || tone === 'locked';
}

export function actionPillClass(tone: ActionTone): string {
  return `inline-flex max-w-[11.5rem] items-center truncate rounded-full px-2 py-0.5 text-[11px] font-semibold leading-4 ring-1 ${TONE_CLASS[tone]}`;
}
