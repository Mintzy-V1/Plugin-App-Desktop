import type { Workbook } from 'exceljs';
import type { PerformanceStats, TradingSession } from '../pluginApi';

/**
 * Dashboard Excel export. ExcelJS (~1 MB) is loaded on demand so it never
 * weighs on the app's first paint.
 */
export interface DashboardExport {
  stats: PerformanceStats | null;
  sessions: TradingSession[];
  monthlyPnl: number | null;
  equity: number | null;
  cash: number | null;
  accountName?: string;
  broker?: string;
}

export async function exportDashboardXlsx(data: DashboardExport): Promise<string> {
  const { default: ExcelJS } = await import('exceljs');
  const wb: Workbook = new ExcelJS.Workbook();
  wb.creator = 'Mintzy Plugin';
  wb.created = new Date();
  const { buildSummary, buildDataSheets } = await import('./sheets');
  buildSummary(wb, data);
  buildDataSheets(wb, data);

  const buffer = await wb.xlsx.writeBuffer();
  const asOf = data.stats?.asOfDate ?? new Date().toISOString().slice(0, 10);
  const filename = `Mintzy-performance-${asOf}.xlsx`;
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return filename;
}
