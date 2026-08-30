import { useEffect, useRef, useState } from 'react';
import {
  createChart,
  createSeriesMarkers,
  CandlestickSeries,
  BaselineSeries,
  ColorType,
  CrosshairMode,
  LineStyle,
  TickMarkType,
  type IChartApi,
  type ISeriesApi,
  type ITimeScaleApi,
  type UTCTimestamp,
  type Time,
  type Logical,
} from 'lightweight-charts';
import { ZoomIn, ZoomOut, Maximize2, Minimize2 } from 'lucide-react';

const GREEN = '#10b981';
const RED = '#ef4444';
const IST = 'Asia/Kolkata';

export interface ChartLinePoint {
  ts: number;
  value: number;
}

export interface ChartCandle {
  ts: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface Props {
  mode: 'area' | 'candle';
  line: ChartLinePoint[];
  candles: ChartCandle[];
  liveAt: number | null;
}

function asUtc(tsMs: number): UTCTimestamp {
  return Math.floor(tsMs / 1000) as UTCTimestamp;
}

function formatIstClock(time: Time, withSeconds = false): string {
  const sec = typeof time === 'number' ? time : 0;
  const opts: Intl.DateTimeFormatOptions = {
    timeZone: IST,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  };
  if (withSeconds) opts.second = '2-digit';
  return new Date(sec * 1000).toLocaleTimeString('en-IN', opts);
}

function formatIstTick(time: Time, tickMarkType: TickMarkType): string {
  const sec = typeof time === 'number' ? time : 0;
  const d = new Date(sec * 1000);
  if (tickMarkType === TickMarkType.Year) {
    return d.toLocaleDateString('en-IN', { timeZone: IST, year: 'numeric' });
  }
  if (tickMarkType === TickMarkType.Month) {
    return d.toLocaleDateString('en-IN', { timeZone: IST, month: 'short' });
  }
  if (tickMarkType === TickMarkType.DayOfMonth) {
    return d.toLocaleDateString('en-IN', { timeZone: IST, day: 'numeric', month: 'short' });
  }
  return formatIstClock(time, tickMarkType === TickMarkType.TimeWithSeconds);
}

function formatPnl(value: number): string {
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}₹${Math.abs(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function uniqueTimes<T extends { time: UTCTimestamp }>(rows: T[]): T[] {
  const byTime = new Map<number, T>();
  for (const row of rows) byTime.set(row.time as number, row);
  return Array.from(byTime.values()).sort((a, b) => (a.time as number) - (b.time as number));
}

export default function SessionTradingChart({ mode, line, candles, liveAt }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Baseline'> | ISeriesApi<'Candlestick'> | null>(null);
  const barCountRef = useRef(0);
  const clampingRef = useRef(false);
  const [expanded, setExpanded] = useState(false);

  const applyData = (
    series: ISeriesApi<'Baseline'> | ISeriesApi<'Candlestick'>,
    nextMode: 'area' | 'candle',
    nextLine: ChartLinePoint[],
    nextCandles: ChartCandle[],
  ) => {
    if (nextMode === 'candle') {
      const rows = uniqueTimes(nextCandles.map((c) => ({
        time: asUtc(c.ts),
        open: c.open,
        high: Math.max(c.high, c.open, c.close),
        low: Math.min(c.low, c.open, c.close),
        close: c.close,
      })));
      barCountRef.current = rows.length;
      (series as ISeriesApi<'Candlestick'>).setData(rows);
      return;
    }
    const rows = uniqueTimes(nextLine.map((p) => ({
      time: asUtc(p.ts),
      value: p.value,
    })));
    barCountRef.current = rows.length;
    (series as ISeriesApi<'Baseline'>).setData(rows);
  };

  const clampVisibleRange = (ts: ITimeScaleApi<Time>) => {
    if (clampingRef.current) return;
    const count = barCountRef.current;
    if (count < 2) return;
    const range = ts.getVisibleLogicalRange();
    if (!range) return;
    const maxTo = count - 1;
    const minSpan = Math.min(4, maxTo);
    let from = range.from as number;
    let to = range.to as number;
    const span = to - from;

    if (!Number.isFinite(from) || !Number.isFinite(to) || span <= 0) {
      clampingRef.current = true;
      ts.fitContent();
      clampingRef.current = false;
      return;
    }

    if (span > maxTo) {
      clampingRef.current = true;
      ts.fitContent();
      clampingRef.current = false;
      return;
    }
    if (span < minSpan) {
      const mid = (from + to) / 2;
      from = mid - minSpan / 2;
      to = mid + minSpan / 2;
    }
    if (from < 0) {
      to -= from;
      from = 0;
    }
    if (to > maxTo) {
      from -= to - maxTo;
      to = maxTo;
    }
    from = Math.max(0, from);
    to = Math.min(maxTo, Math.max(from + minSpan, to));
    if (Math.abs(from - (range.from as number)) > 0.02 || Math.abs(to - (range.to as number)) > 0.02) {
      clampingRef.current = true;
      ts.setVisibleLogicalRange({ from: from as Logical, to: to as Logical });
      clampingRef.current = false;
    }
  };

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;

    const chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: '#ffffff' },
        textColor: '#64748b',
        fontFamily: 'Plus Jakarta Sans, ui-sans-serif, system-ui, sans-serif',
        fontSize: 11,
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: '#f1f5f9' },
        horzLines: { color: '#f1f5f9' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: '#94a3b8', width: 1, style: LineStyle.Dashed, labelBackgroundColor: '#0f172a' },
        horzLine: { color: '#94a3b8', width: 1, style: LineStyle.Dashed, labelBackgroundColor: '#0f172a' },
      },
      rightPriceScale: {
        borderColor: '#e2e8f0',
        scaleMargins: { top: 0.12, bottom: 0.12 },
      },
      timeScale: {
        borderColor: '#e2e8f0',
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 0,
        barSpacing: mode === 'candle' ? 8 : 6,
        minBarSpacing: 3,
        fixLeftEdge: true,
        fixRightEdge: true,
        lockVisibleTimeRangeOnResize: false,
        shiftVisibleRangeOnNewBar: false,
        tickMarkMaxCharacterLength: 12,
        tickMarkFormatter: formatIstTick,
      },
      localization: {
        locale: 'en-IN',
        timeFormatter: (time: Time) => formatIstClock(time),
        priceFormatter: formatPnl,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
      },
    });

    chartRef.current = chart;

    const priceFormat = {
      type: 'custom' as const,
      minMove: 0.01,
      formatter: formatPnl,
    };

    const series = mode === 'candle'
      ? chart.addSeries(CandlestickSeries, {
          upColor: GREEN,
          downColor: RED,
          borderUpColor: GREEN,
          borderDownColor: RED,
          wickUpColor: GREEN,
          wickDownColor: RED,
          priceFormat,
        })
      : chart.addSeries(BaselineSeries, {
          baseValue: { type: 'price', price: 0 },
          topLineColor: GREEN,
          topFillColor1: 'rgba(16, 185, 129, 0.28)',
          topFillColor2: 'rgba(16, 185, 129, 0.02)',
          bottomLineColor: RED,
          bottomFillColor1: 'rgba(239, 68, 68, 0.28)',
          bottomFillColor2: 'rgba(239, 68, 68, 0.02)',
          lineWidth: 2,
          priceFormat,
        });

    seriesRef.current = series;
    applyData(series, mode, line, candles);

    if (liveAt != null && Number.isFinite(liveAt)) {
      createSeriesMarkers(series, [{
        time: asUtc(liveAt),
        position: 'aboveBar',
        color: '#d97706',
        shape: 'arrowDown',
        text: 'Live',
      }]);
    }

    const ts = chart.timeScale();
    ts.fitContent();
    const onRangeChange = () => clampVisibleRange(ts);
    ts.subscribeVisibleLogicalRangeChange(onRangeChange);

    return () => {
      ts.unsubscribeVisibleLogicalRangeChange(onRangeChange);
      seriesRef.current = null;
      chart.remove();
      chartRef.current = null;
    };
    // Recreate when series type or live marker changes. Data ticks update below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, liveAt]);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;
    applyData(series, mode, line, candles);
    const ts = chartRef.current?.timeScale();
    if (ts) clampVisibleRange(ts);
  }, [mode, line, candles]);

  const zoom = (factor: number) => {
    const ts = chartRef.current?.timeScale();
    if (!ts) return;
    const range = ts.getVisibleLogicalRange();
    if (!range) {
      ts.fitContent();
      return;
    }
    const maxTo = Math.max(barCountRef.current - 1, 1);
    const mid = (range.from + range.to) / 2;
    const span = Math.max((range.to - range.from) * factor, 4);
    if (span >= maxTo) {
      ts.fitContent();
      return;
    }
    let from = mid - span / 2;
    let to = mid + span / 2;
    if (from < 0) {
      to -= from;
      from = 0;
    }
    if (to > maxTo) {
      from -= to - maxTo;
      to = maxTo;
    }
    ts.setVisibleLogicalRange({
      from: Math.max(0, from) as Logical,
      to: Math.min(maxTo, to) as Logical,
    });
  };

  const hasData = mode === 'candle' ? candles.length > 1 : line.length > 1;

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpanded(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expanded]);

  useEffect(() => {
    const el = hostRef.current;
    const chart = chartRef.current;
    if (!el || !chart) return;
    const applySize = () => {
      const width = el.clientWidth;
      const height = el.clientHeight;
      if (width < 2 || height < 2) return;
      chart.resize(width, height, true);
      chart.priceScale('right').applyOptions({ autoScale: true });
      chart.timeScale().fitContent();
    };
    const id = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(applySize);
    });
    return () => window.cancelAnimationFrame(id);
  }, [expanded]);

  return (
    <div className={expanded ? 'h-[320px]' : undefined}>
      <div
        className={
          expanded
            ? 'fixed inset-0 z-50 flex flex-col bg-white p-4'
            : undefined
        }
      >
        <div className="mb-2 flex justify-end gap-1">
          <button
            type="button"
            onClick={() => zoom(0.6)}
            disabled={!hasData}
            title="Zoom in"
            aria-label="Zoom in"
            className="rounded-md border border-slate-200 p-1.5 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:opacity-40"
          >
            <ZoomIn className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => zoom(1.6)}
            disabled={!hasData}
            title="Zoom out"
            aria-label="Zoom out"
            className="rounded-md border border-slate-200 p-1.5 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:opacity-40"
          >
            <ZoomOut className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setExpanded((open) => !open)}
            disabled={!hasData}
            title={expanded ? 'Exit full chart' : 'Expand chart'}
            aria-label={expanded ? 'Exit full chart' : 'Expand chart'}
            aria-pressed={expanded}
            className="rounded-md border border-slate-200 p-1.5 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:opacity-40"
          >
            {expanded
              ? <Minimize2 className="h-3.5 w-3.5" aria-hidden="true" />
              : <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />}
          </button>
        </div>
        <div
          ref={hostRef}
          className={expanded ? 'min-h-0 w-full flex-1' : 'h-[320px] w-full'}
          onWheel={(e) => e.stopPropagation()}
        />
      </div>
    </div>
  );
}
