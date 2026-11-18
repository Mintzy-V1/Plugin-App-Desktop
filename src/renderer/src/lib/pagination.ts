/** Presentation helpers; never apply these to inputs used to calculate financial values. */
export function pageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(Math.max(0, total) / Math.max(1, pageSize)));
}
export function clampPage(page: number, total: number, pageSize: number): number {
  return Math.max(1, Math.min(Number.isFinite(page) ? Math.floor(page) : 1, pageCount(total, pageSize)));
}
export function pageItems(current: number, count: number): Array<number | 'gap'> {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1);
  const wanted = new Set([1, count, current - 1, current, current + 1]);
  const numbers = [...wanted].filter(n => n >= 1 && n <= count).sort((a, b) => a - b);
  const items: Array<number | 'gap'> = [];
  numbers.forEach((n, i) => { if (i && n - numbers[i - 1] > 1) items.push('gap'); items.push(n); });
  return items;
}
