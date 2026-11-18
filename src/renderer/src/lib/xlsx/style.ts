import type { Borders, Cell, Fill, Font, Worksheet } from 'exceljs';

/** Shared styling for the dashboard Excel export. */

// Brand palette (ARGB). Gain/loss match the app's light theme tokens.
export const C = {
  forest: 'FF183527', forestText: 'FFE8EFE9', mint: 'FF9CC7AD',
  ink: 'FF1D1B16', secondary: 'FF5B5548', muted: 'FF736C5E',
  canvas: 'FFF6F4EF', subtle: 'FFFAF8F3', line: 'FFE6E0D3', white: 'FFFFFFFF',
  gain: 'FF2F6B4F', gainSoft: 'FFE3EFE7', loss: 'FFA23B2A', lossSoft: 'FFF9E1DC',
};
export const FONT = 'Calibri';
export const INR = '+"₹"#,##0.00;-"₹"#,##0.00;"₹"0.00';
export const INR0 = '+"₹"#,##0;-"₹"#,##0;"₹"0';
export const INR_PLAIN = '"₹"#,##0.00';
export const PCT = '+0.00%;-0.00%;0.00%';
export const PCT_PLAIN = '0.0%';
export const DATE = 'ddd, dd mmm yyyy';

export const solid = (argb: string): Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
export const hair = (argb = C.line): Partial<Borders> => ({
  top: { style: 'thin', color: { argb } }, bottom: { style: 'thin', color: { argb } },
  left: { style: 'thin', color: { argb } }, right: { style: 'thin', color: { argb } },
});
export const font = (f: Partial<Font> = {}): Partial<Font> => ({ name: FONT, size: 10, color: { argb: C.ink }, ...f });
export const toneArgb = (n: number | null | undefined) => (n == null || n === 0 ? C.ink : n > 0 ? C.gain : C.loss);
export const dateOf = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
/** Excel has no time zones: store IST wall-clock time. */
export const istDate = (iso: string) => {
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : new Date(ms + 330 * 60_000);
};
export const pctOrNull = (n: number | null | undefined) => (n == null || !Number.isFinite(n) ? null : n / 100);
/** Text bar for in-cell comparison; ten blocks = the largest absolute value. */
export const bar = (value: number, max: number) => (max > 0 ? '█'.repeat(Math.max(value ? 1 : 0, Math.round((Math.abs(value) / max) * 10))) : '');

export function banner(ws: Worksheet, lastCol: string, title: string, subtitle: string) {
  ws.mergeCells(`A1:${lastCol}1`);
  ws.mergeCells(`A2:${lastCol}2`);
  const t = ws.getCell('A1');
  t.value = title;
  t.font = font({ size: 16, bold: true, color: { argb: C.white } });
  t.alignment = { vertical: 'middle', indent: 1 };
  const s = ws.getCell('A2');
  s.value = subtitle;
  s.font = font({ size: 10, color: { argb: C.mint } });
  s.alignment = { vertical: 'top', indent: 1 };
  for (const r of [1, 2]) ws.getRow(r).eachCell({ includeEmpty: true }, (c) => { c.fill = solid(C.forest); });
  ws.getRow(1).height = 30;
  ws.getRow(2).height = 22;
}

/** Styled data table: header row, zebra rows, frozen header, filter. */
export function table(ws: Worksheet, headerRow: number, columns: { header: string; key: string; width: number; numFmt?: string; align?: 'left' | 'right' | 'center' }[], rows: Record<string, unknown>[]) {
  ws.columns = columns.map((c) => ({ key: c.key, width: c.width }));
  const head = ws.getRow(headerRow);
  columns.forEach((c, i) => {
    const cell = head.getCell(i + 1);
    cell.value = c.header;
    cell.font = font({ bold: true, size: 9, color: { argb: C.white } });
    cell.fill = solid(C.gain);
    cell.alignment = { vertical: 'middle', horizontal: c.align ?? 'left', indent: 1 };
    cell.border = { bottom: { style: 'medium', color: { argb: C.forest } } };
  });
  head.height = 24;
  rows.forEach((data, idx) => {
    const row = ws.getRow(headerRow + 1 + idx);
    columns.forEach((c, i) => {
      const cell = row.getCell(i + 1);
      cell.value = (data[c.key] ?? null) as Cell['value'];
      cell.font = font();
      if (c.numFmt) cell.numFmt = c.numFmt;
      cell.alignment = { vertical: 'middle', horizontal: c.align ?? 'left', indent: 1 };
      cell.fill = solid(idx % 2 ? C.subtle : C.white);
      cell.border = { bottom: { style: 'hair', color: { argb: C.line } } };
    });
    row.height = 18;
  });
  ws.views = [{ state: 'frozen', ySplit: headerRow, showGridLines: false }];
  if (rows.length) ws.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: headerRow + rows.length, column: columns.length } };
  return { first: headerRow + 1, last: headerRow + rows.length };
}

/** Colour signed money/percent cells and their bar cells by sign. */
export function toneColumns(ws: Worksheet, first: number, last: number, cols: number[]) {
  for (let r = first; r <= last; r++) {
    for (const col of cols) {
      const cell = ws.getRow(r).getCell(col);
      const v = typeof cell.value === 'number' ? cell.value : null;
      cell.font = font({ bold: true, color: { argb: toneArgb(v) } });
    }
  }
}

export function barColumn(ws: Worksheet, first: number, last: number, col: number, values: number[]) {
  for (let r = first; r <= last; r++) {
    const v = values[r - first] ?? 0;
    ws.getRow(r).getCell(col).font = font({ size: 9, color: { argb: v < 0 ? C.loss : C.gain } });
  }
}

export function colorScale(ws: Worksheet, ref: string) {
  ws.addConditionalFormatting({
    ref,
    rules: [{
      type: 'colorScale', priority: 1,
      cfvo: [{ type: 'min' }, { type: 'num', value: 0 }, { type: 'max' }],
      color: [{ argb: C.lossSoft }, { argb: C.white }, { argb: C.gainSoft }],
    }],
  });
}

export function setup(ws: Worksheet, tab: string, onePage = false) {
  ws.properties.tabColor = { argb: tab };
  ws.pageSetup = { orientation: onePage ? 'portrait' : 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: onePage ? 1 : 0, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } };
  ws.headerFooter.oddFooter = '&L&8Mintzy · Account performance&R&8Page &P of &N';
}

