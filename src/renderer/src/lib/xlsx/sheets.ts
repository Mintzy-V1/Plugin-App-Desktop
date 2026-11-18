import type { Workbook, Worksheet } from 'exceljs';
import type { DashboardExport } from './index';
import { sessionStatusLabel } from '../sessionStatus';
import {
  C, DATE, INR, INR0, INR_PLAIN, PCT, PCT_PLAIN, banner, bar, barColumn, colorScale, dateOf, font, hair,
  istDate, pctOrNull, setup, solid, table, toneArgb, toneColumns,
} from './style';

type Card = { label: string; value: number | string | null; fmt?: string; detail?: string; tone?: number | null };

/** A 2-column-wide card: small caps label, large value, muted detail. */
function card(ws: Worksheet, row: number, col: number, c: Card) {
  const cols = [col, col + 1];
  ws.mergeCells(row, col, row, col + 1);
  ws.mergeCells(row + 1, col, row + 1, col + 1);
  ws.mergeCells(row + 2, col, row + 2, col + 1);
  const label = ws.getCell(row, col);
  label.value = c.label.toUpperCase();
  label.font = font({ size: 8, bold: true, color: { argb: C.muted } });
  const value = ws.getCell(row + 1, col);
  value.value = c.value ?? '—';
  if (c.fmt && typeof c.value === 'number') value.numFmt = c.fmt;
  value.font = font({ size: 18, bold: true, color: { argb: c.value == null ? C.muted : toneArgb(c.tone) } });
  const detail = ws.getCell(row + 2, col);
  detail.value = c.detail ?? '';
  detail.font = font({ size: 9, color: { argb: C.muted } });
  for (let r = row; r <= row + 2; r++) {
    for (const cc of cols) {
      const cell = ws.getCell(r, cc);
      cell.fill = solid(C.canvas);
      cell.alignment = { vertical: r === row + 1 ? 'middle' : r === row ? 'bottom' : 'top', horizontal: 'left', indent: 1 };
      cell.border = {
        top: r === row ? { style: 'thin', color: { argb: C.line } } : undefined,
        bottom: r === row + 2 ? { style: 'thin', color: { argb: C.line } } : undefined,
        left: cc === col ? { style: 'medium', color: { argb: c.tone == null ? C.line : toneArgb(c.tone) } } : undefined,
        // A thick white right edge reads as a gutter between neighbouring cards.
        right: cc === col + 1 ? { style: 'thick', color: { argb: C.white } } : undefined,
      };
    }
  }
}

function sectionTitle(ws: Worksheet, row: number, text: string, lastCol = 8) {
  ws.mergeCells(row, 2, row, lastCol);
  const cell = ws.getCell(row, 2);
  cell.value = text;
  cell.font = font({ size: 12, bold: true, color: { argb: C.forest } });
  cell.border = { bottom: { style: 'medium', color: { argb: C.gain } } };
  ws.getRow(row).height = 22;
}

export function buildSummary(wb: Workbook, d: DashboardExport) {
  const s = d.stats;
  const ws = wb.addWorksheet('Summary', { views: [{ showGridLines: false }] });
  setup(ws, C.forest, true);
  ws.columns = [{ width: 2 }, ...Array.from({ length: 7 }, () => ({ width: 17 })), { width: 2 }];
  const asOf = s?.asOfDate ? dateOf(s.asOfDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : 'today';
  banner(ws, 'I', 'Mintzy  ·  Account performance', [d.accountName, d.broker, `Live trading through ${asOf}`, `Exported ${new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}`].filter(Boolean).join('   ·   '));

  const months = s?.months ?? [];
  const thisMonth = d.monthlyPnl ?? months[months.length - 1]?.pnl ?? null;
  const lastMonth = months[months.length - 2]?.pnl ?? null;
  sectionTitle(ws, 4, 'At a glance');
  // Three 2-column cards per row (B–C, D–E, F–G); column H is breathing room.
  const grid: Card[][] = [
    [
      { label: 'Net P&L · all time', value: s?.totalPnl ?? null, fmt: INR0, tone: s?.totalPnl, detail: s?.startCapital ? `on ₹${s.startCapital.toLocaleString('en-IN')} starting capital` : undefined },
      { label: 'Overall return', value: pctOrNull(s?.overallReturnPct), fmt: PCT, tone: s?.overallReturnPct, detail: s ? `${s.tradingDays} trading days` : undefined },
      { label: 'This month', value: thisMonth, fmt: INR0, tone: thisMonth, detail: lastMonth != null && thisMonth != null ? `${thisMonth - lastMonth >= 0 ? '+' : '−'}₹${Math.abs(Math.round(thisMonth - lastMonth)).toLocaleString('en-IN')} vs last month` : undefined },
    ],
    [
      { label: 'Equity', value: d.equity, fmt: INR_PLAIN, detail: 'Latest account value' },
      { label: 'Cash in broker', value: d.cash, fmt: INR_PLAIN, detail: 'Free cash last read' },
      { label: 'Win rate', value: pctOrNull(s?.avgWinRate), fmt: PCT_PLAIN, detail: s ? `${s.winningDays ?? 0} green · ${s.losingDays ?? 0} red days` : undefined },
    ],
    [
      { label: 'Profit factor', value: s?.profitFactor ?? null, fmt: '0.00', tone: s?.profitFactor != null ? s.profitFactor - 1 : null, detail: 'Gross profit ÷ gross loss' },
      { label: 'Max drawdown', value: s?.maxDrawdownPct != null ? -s.maxDrawdownPct / 100 : null, fmt: PCT, tone: s?.maxDrawdownAmount ? -1 : null, detail: s?.maxDrawdownAmount ? `−₹${Math.round(s.maxDrawdownAmount).toLocaleString('en-IN')} from peak` : undefined },
      { label: 'Sharpe ratio', value: s?.sharpeRatio ?? null, fmt: '0.00', tone: s?.sharpeRatio != null ? s.sharpeRatio - 1 : null, detail: s?.sortinoRatio != null ? `Sortino ${s.sortinoRatio.toFixed(2)}` : 'Needs 5+ trading days' },
    ],
  ];
  let row = 6;
  for (const line of grid) {
    line.forEach((c, i) => card(ws, row, 2 + i * 2, c));
    ws.getRow(row).height = 16;
    ws.getRow(row + 1).height = 28;
    ws.getRow(row + 2).height = 16;
    row += 4;
  }

  sectionTitle(ws, row, 'Key metrics');
  row += 2;
  const metrics: [string, number | string | null | undefined, string, number | null | undefined][] = [
    ['Risk : reward', s?.avgRiskReward != null ? `1 : ${s.avgRiskReward.toFixed(2)}` : null, '@', null],
    ['Average day (expectancy)', s?.expectancy, INR, s?.expectancy],
    ['Average green day', s?.avgWinDay, INR, s?.avgWinDay],
    ['Average red day', s?.avgLossDay, INR, s?.avgLossDay],
    ['Gross profit', s?.grossProfit, INR, s?.grossProfit],
    ['Gross loss', s?.grossLoss != null ? -s.grossLoss : null, INR, s?.grossLoss ? -1 : null],
    ['Max drawdown (₹)', s?.maxDrawdownAmount != null ? -s.maxDrawdownAmount : null, INR, s?.maxDrawdownAmount ? -1 : null],
    ['Current drawdown (₹)', s?.currentDrawdownAmount != null ? -s.currentDrawdownAmount : null, INR, s?.currentDrawdownAmount ? -1 : null],
    ['Recovery factor', s?.recoveryFactor, '0.00', null],
    ['Symbol win rate', pctOrNull(s?.symbolWinRate), PCT_PLAIN, null],
    ['Longest green / red streak', s ? `${s.maxWinStreak} / ${s.maxLoseStreak} days` : null, '@', null],
    ['Sessions · symbols traded', s ? `${s.sessions ?? 0} · ${s.symbolsTraded ?? 0}` : null, '@', null],
  ];
  metrics.forEach(([label, value, fmt, tone], i) => {
    const r = row + Math.floor(i / 2);
    const col = i % 2 === 0 ? 2 : 6;
    ws.mergeCells(r, col, r, col + 1);
    const l = ws.getCell(r, col);
    l.value = label;
    l.font = font({ color: { argb: C.secondary } });
    const v = ws.getCell(r, col + 2);
    v.value = value ?? '—';
    if (typeof value === 'number') v.numFmt = fmt;
    v.font = font({ bold: true, color: { argb: toneArgb(tone ?? null) } });
    v.alignment = { horizontal: 'right' };
    for (const c of [col, col + 1, col + 2]) ws.getCell(r, c).border = { bottom: { style: 'hair', color: { argb: C.line } } };
  });
  row += Math.ceil(metrics.length / 2) + 1;

  sectionTitle(ws, row, 'Records');
  row += 2;
  ['Category', 'Best', 'When / what', 'Worst', 'When / what'].forEach((h, i) => {
    const cell = ws.getCell(row, 2 + i);
    cell.value = h;
    cell.font = font({ size: 9, bold: true, color: { argb: C.white } });
    cell.fill = solid(C.gain);
    cell.alignment = { vertical: 'middle', indent: 1, horizontal: i === 1 || i === 3 ? 'right' : 'left' };
  });
  ws.getRow(row).height = 22;
  const records = [
    ['Day', s?.maxProfitDay, s?.maxLosingDay],
    ['Symbol', s?.maxProfitScript, s?.maxLosingScript],
    ['Month', s?.bestMonth, s?.worstMonth],
  ] as const;
  records.forEach(([label, best, worst], i) => {
    const r = row + 1 + i;
    const cells = [label, best?.value ?? '—', best?.label ?? '', worst?.value ?? '—', worst?.label ?? ''];
    cells.forEach((v, j) => {
      const cell = ws.getCell(r, 2 + j);
      cell.value = v;
      cell.fill = solid(i % 2 ? C.subtle : C.white);
      cell.border = { bottom: { style: 'hair', color: { argb: C.line } } };
      cell.alignment = { indent: 1, horizontal: j === 1 || j === 3 ? 'right' : 'left' };
      cell.font = font(j === 0 ? { bold: true } : j === 1 ? { bold: true, color: { argb: C.gain } } : j === 3 ? { bold: true, color: { argb: C.loss } } : { color: { argb: C.secondary } });
      if (typeof v === 'number') cell.numFmt = INR0;
    });
  });
  row += records.length + 3;

  ws.mergeCells(row, 2, row + 2, 8);
  const note = ws.getCell(row, 2);
  note.value = 'How these figures are calculated: each symbol contributes its latest realised + unrealised P&L per IST day per session; simulation (paper) trades are excluded. Drawdown % is measured against account value at the previous high. Sharpe and Sortino are annualised (×√252) from daily returns. The other sheets hold the daily series, monthly comparison, symbol and weekday breakdowns, and session history.';
  note.font = font({ size: 9, italic: true, color: { argb: C.muted } });
  note.alignment = { wrapText: true, vertical: 'top' };
  note.border = hair();
  note.fill = solid(C.subtle);
}

export function buildDataSheets(wb: Workbook, d: DashboardExport) {
  const s = d.stats;

  // Daily series ------------------------------------------------------------
  const daily = s?.daily ?? [];
  const wsD = wb.addWorksheet('Daily P&L');
  setup(wsD, C.gain);
  banner(wsD, 'G', 'Daily P&L', 'One row per live trading day · cumulative P&L and distance below the running peak');
  const dRows = daily.map((x) => ({
    date: dateOf(x.date), pnl: x.pnl, cumulative: x.cumulative, drawdown: x.drawdown,
    drawdownPct: pctOrNull(x.drawdownPct), returnPct: pctOrNull(x.returnPct), symbols: x.symbols,
  }));
  const dr = table(wsD, 4, [
    { header: 'Date', key: 'date', width: 20, numFmt: DATE },
    { header: 'Day P&L', key: 'pnl', width: 16, numFmt: INR, align: 'right' },
    { header: 'Cumulative P&L', key: 'cumulative', width: 18, numFmt: INR, align: 'right' },
    { header: 'Below peak (₹)', key: 'drawdown', width: 16, numFmt: INR, align: 'right' },
    { header: 'Below peak (%)', key: 'drawdownPct', width: 15, numFmt: PCT, align: 'right' },
    { header: 'Day return', key: 'returnPct', width: 13, numFmt: PCT, align: 'right' },
    { header: 'Symbols', key: 'symbols', width: 10, align: 'right' },
  ], dRows);
  if (daily.length) {
    toneColumns(wsD, dr.first, dr.last, [2, 3, 4, 5, 6]);
    colorScale(wsD, `B${dr.first}:B${dr.last}`);
    const total = wsD.getRow(dr.last + 1);
    total.getCell(1).value = 'Total';
    total.getCell(2).value = { formula: `SUM(B${dr.first}:B${dr.last})`, result: s?.totalPnl ?? 0 };
    total.getCell(2).numFmt = INR;
    [1, 2, 3, 4, 5, 6, 7].forEach((c) => {
      const cell = total.getCell(c);
      cell.font = font({ bold: true, color: { argb: c === 2 ? toneArgb(s?.totalPnl) : C.ink } });
      cell.fill = solid(C.canvas);
      cell.border = { top: { style: 'medium', color: { argb: C.forest } } };
      cell.alignment = { indent: 1, horizontal: c === 1 ? 'left' : 'right' };
    });
  }

  // Monthly -----------------------------------------------------------------
  const months = [...(s?.months ?? [])].reverse();
  const wsM = wb.addWorksheet('Monthly');
  setup(wsM, C.gain);
  banner(wsM, 'H', 'Month over month', 'Last 12 months, newest first · change is against the previous traded month');
  const traded = months.filter((m) => m.pnl != null);
  const maxM = Math.max(0, ...traded.map((m) => Math.abs(m.pnl ?? 0)));
  const mRows = months.map((m, i) => {
    const prior = months.slice(i + 1).find((p) => p.pnl != null);
    return {
      month: m.label, pnl: m.pnl, bar: m.pnl != null ? bar(m.pnl, maxM) : 'No trading',
      returnPct: pctOrNull(m.returnPct), days: m.tradingDays ?? 0, green: m.winDays ?? 0,
      winRate: m.tradingDays ? (m.winDays ?? 0) / m.tradingDays : null,
      delta: m.pnl != null && prior?.pnl != null ? m.pnl - prior.pnl : null,
    };
  });
  const mr = table(wsM, 4, [
    { header: 'Month', key: 'month', width: 14 },
    { header: 'P&L', key: 'pnl', width: 16, numFmt: INR, align: 'right' },
    { header: '', key: 'bar', width: 14 },
    { header: 'Return', key: 'returnPct', width: 11, numFmt: PCT, align: 'right' },
    { header: 'Trading days', key: 'days', width: 13, align: 'right' },
    { header: 'Green days', key: 'green', width: 12, align: 'right' },
    { header: 'Win rate', key: 'winRate', width: 11, numFmt: PCT_PLAIN, align: 'right' },
    { header: 'vs prior month', key: 'delta', width: 16, numFmt: INR, align: 'right' },
  ], mRows);
  toneColumns(wsM, mr.first, mr.last, [2, 4, 8]);
  barColumn(wsM, mr.first, mr.last, 3, mRows.map((m) => m.pnl ?? 0));

  // Symbols -----------------------------------------------------------------
  const symbols = s?.symbols ?? [];
  const wsS = wb.addWorksheet('Symbols');
  setup(wsS, C.gain);
  banner(wsS, 'E', 'Symbols', 'Net P&L per traded symbol, best first');
  const maxS = Math.max(0, ...symbols.map((x) => Math.abs(x.pnl)));
  const sRows = symbols.map((x) => ({ symbol: x.symbol, pnl: x.pnl, bar: bar(x.pnl, maxS), days: x.days, winRate: pctOrNull(x.winRate) }));
  const sr = table(wsS, 4, [
    { header: 'Symbol', key: 'symbol', width: 18 },
    { header: 'Net P&L', key: 'pnl', width: 16, numFmt: INR, align: 'right' },
    { header: '', key: 'bar', width: 14 },
    { header: 'Days traded', key: 'days', width: 13, align: 'right' },
    { header: 'Win rate', key: 'winRate', width: 11, numFmt: PCT_PLAIN, align: 'right' },
  ], sRows);
  toneColumns(wsS, sr.first, sr.last, [2]);
  barColumn(wsS, sr.first, sr.last, 3, sRows.map((x) => x.pnl));

  // Weekdays ----------------------------------------------------------------
  const weekdays = s?.weekdays ?? [];
  const wsW = wb.addWorksheet('Weekdays');
  setup(wsW, C.gain);
  banner(wsW, 'F', 'By weekday', 'Average and total P&L for each weekday');
  const maxW = Math.max(0, ...weekdays.map((x) => Math.abs(x.avgPnl ?? 0)));
  const wRows = weekdays.map((x) => ({ day: x.label, avg: x.avgPnl, bar: bar(x.avgPnl ?? 0, maxW), total: x.pnl, days: x.days, winRate: pctOrNull(x.winRate) }));
  const wr = table(wsW, 4, [
    { header: 'Weekday', key: 'day', width: 12 },
    { header: 'Average P&L', key: 'avg', width: 15, numFmt: INR, align: 'right' },
    { header: '', key: 'bar', width: 14 },
    { header: 'Total P&L', key: 'total', width: 16, numFmt: INR, align: 'right' },
    { header: 'Days', key: 'days', width: 8, align: 'right' },
    { header: 'Win rate', key: 'winRate', width: 11, numFmt: PCT_PLAIN, align: 'right' },
  ], wRows);
  toneColumns(wsW, wr.first, wr.last, [2, 4]);
  barColumn(wsW, wr.first, wr.last, 3, wRows.map((x) => x.avg ?? 0));

  // Sessions ----------------------------------------------------------------
  const wsX = wb.addWorksheet('Sessions');
  setup(wsX, C.muted);
  banner(wsX, 'D', 'Sessions', 'Every session on this account, newest first · times in IST');
  table(wsX, 4, [
    { header: 'Strategy', key: 'strategy', width: 26 },
    { header: 'Session ID', key: 'id', width: 34 },
    { header: 'Started (IST)', key: 'started', width: 24, numFmt: 'ddd, dd mmm yyyy  h:mm AM/PM' },
    { header: 'Status', key: 'status', width: 14 },
  ], d.sessions.map((x) => ({ strategy: x.configuration_name || 'One-off session', id: x.python_session_id, started: istDate(x.created_at), status: sessionStatusLabel(x.status) })));
}
