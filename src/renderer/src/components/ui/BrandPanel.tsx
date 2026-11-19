import { Activity, Layers, LineChart } from 'lucide-react';

const FEATURES = [
  { icon: Activity, title: 'Live P&L and trade log', body: 'Every position, signal and exit as it happens.' },
  { icon: Layers, title: 'Saved strategies', body: 'Symbols, capital, stop-loss and leverage — reusable in one click.' },
  { icon: LineChart, title: 'Performance analytics', body: 'Equity curve, drawdown, win rate and monthly comparison.' },
];

// Illustrative equity path in a 600×420 box: a seeded random walk with an
// upward drift, so it reads like a real account rather than a sine wave. It
// ends short of the right edge so the live marker has room.
const W = 600;
const H = 420;
const LAST_X = 560;
function walk(seed: number, steps: number, from: number, to: number, noise: number): [number, number][] {
  let r = seed;
  const rand = () => ((r = (r * 16807) % 2147483647) / 2147483647) - 0.5;
  const pts: [number, number][] = [];
  let shock = 0;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    shock = shock * 0.55 + rand() * noise;
    const y = i === 0 || i === steps ? from + (to - from) * t : from + (to - from) * Math.pow(t, 1.15) + shock;
    pts.push([+(t * LAST_X).toFixed(1), +y.toFixed(1)]);
  }
  return pts;
}
const EQUITY = walk(7, 34, 372, 150, 46);
const BENCHMARK = walk(19, 10, 372, 290, 10);
const END = EQUITY[EQUITY.length - 1];

/** Catmull-Rom spline through the points, written as cubic Béziers. */
function smoothPath(pts: [number, number][]): string {
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p2[0]} ${p2[1]}`;
  }
  return d;
}

const LINE = smoothPath(EQUITY);
const AREA = `${LINE} L${END[0]} ${H} L0 ${H} Z`;
const BENCH = smoothPath(BENCHMARK);

// The line draws in over DRAW seconds; everything that depends on the finished
// line (marker, guide, shimmer) starts once it lands.
const DRAW = 2.4;
const EASE = '0.65 0 0.35 1';

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Decorative brand side: value statement over a live, drawing equity curve. */
export function BrandPanel() {
  const still = reducedMotion();
  return (
    <aside aria-hidden="true" className="brand-panel relative hidden w-[44%] max-w-[620px] shrink-0 flex-col overflow-hidden p-12 text-[#e8efe9] lg:flex">
      <div className="brand-aurora brand-aurora-a" />
      <div className="brand-aurora brand-aurora-b" />
      <div className="brand-grid" />

      <div className="relative">
        <p className="brand-rise text-[11px] font-semibold uppercase tracking-[0.22em] text-[#9cc7ad]" style={{ animationDelay: '80ms' }}>Mintzy Plugin</p>
        <h2 className="brand-rise mt-5 max-w-sm font-serif text-[2.6rem] leading-[1.1] tracking-tight text-white" style={{ animationDelay: '160ms' }}>
          Automated equity trading, run from your <span className="brand-shine">desk.</span>
        </h2>
      </div>

      <ul className="relative mt-12 space-y-5">
        {FEATURES.map(({ icon: Icon, title, body }, i) => (
          <li key={title} className="brand-rise flex gap-3.5" style={{ animationDelay: `${420 + i * 110}ms` }}>
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.07] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
              <Icon className="h-4 w-4 text-[#9cc7ad]" />
            </span>
            <div><p className="text-sm font-semibold text-white">{title}</p><p className="mt-0.5 text-[13px] text-[#b9cfc1]">{body}</p></div>
          </li>
        ))}
      </ul>

      <div className="relative -mx-12 -mb-12 mt-10 min-h-[220px] flex-1">
        <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMaxYMax slice">
          <defs>
            <linearGradient id="brandArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7fc29b" stopOpacity="0.32" />
              <stop offset="70%" stopColor="#7fc29b" stopOpacity="0.04" />
              <stop offset="100%" stopColor="#7fc29b" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="brandStroke" x1="0" y1="0" x2={W} y2="0" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#7fc29b" stopOpacity="0.25" />
              <stop offset="55%" stopColor="#8fd3aa" />
              <stop offset="100%" stopColor="#c8f2d6" />
            </linearGradient>
            <linearGradient id="brandSheen" x1="0" y1="0" x2="140" y2="0" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
              <stop offset="50%" stopColor="#ffffff" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
              {!still && <animateTransform attributeName="gradientTransform" type="translate" from="-160 0" to="640 0" dur="3.2s" begin={`${DRAW + 0.6}s`} repeatCount="indefinite" />}
            </linearGradient>
            <clipPath id="brandReveal">
              <rect x="0" y="0" height={H} width={still ? W : 0}>
                {!still && <animate attributeName="width" from="0" to={LAST_X + 12} dur={`${DRAW}s`} fill="freeze" calcMode="spline" keyTimes="0;1" keySplines={EASE} />}
              </rect>
            </clipPath>
            <filter id="brandGlow" x="-20%" y="-40%" width="140%" height="180%">
              <feGaussianBlur stdDeviation="6" />
            </filter>
          </defs>

          {[105, 175, 245, 315, 385].map((y, i) => (
            <line key={y} className="brand-fade" style={{ animationDelay: `${i * 90}ms` }} x1="0" x2={W} y1={y} y2={y} stroke="#ffffff" strokeOpacity="0.055" strokeDasharray="2 6" />
          ))}

          <path d={BENCH} pathLength={1} className="brand-draw" style={{ animationDelay: '300ms' }} fill="none" stroke="#ffffff" strokeOpacity="0.22" strokeWidth="1.25" strokeDasharray="1" />
          <path d={AREA} clipPath="url(#brandReveal)" fill="url(#brandArea)" />
          <path d={LINE} pathLength={1} className="brand-draw" fill="none" stroke="#7fc29b" strokeWidth="8" strokeOpacity="0.45" filter="url(#brandGlow)" />
          <path d={LINE} pathLength={1} className="brand-draw" fill="none" stroke="url(#brandStroke)" strokeWidth="2.25" strokeLinecap="round" />
          <path d={LINE} className="brand-after" fill="none" stroke="url(#brandSheen)" strokeWidth="2.25" strokeLinecap="round" />

          <line className="brand-after" x1="0" x2={END[0]} y1={END[1]} y2={END[1]} stroke="#c8f2d6" strokeOpacity="0.28" strokeDasharray="3 5" />

          <g className="brand-after">
            <rect x={END[0] - 70} y={END[1] - 34} width="52" height="18" rx="9" fill="#0f2419" fillOpacity="0.75" stroke="#ffffff" strokeOpacity="0.14" />
            <circle cx={END[0] - 59} cy={END[1] - 25} r="2.5" fill="#8fd3aa" className="brand-blink" />
            <text x={END[0] - 52} y={END[1] - 21.6} fill="#e8efe9" fontSize="8.5" fontWeight="600" letterSpacing="1.2" fontFamily="inherit">LIVE</text>
          </g>

          <g>
            {still
              ? <Marker x={END[0]} y={END[1]} />
              : (
                <g>
                  <Marker x={0} y={0} />
                  <animateMotion dur={`${DRAW}s`} fill="freeze" path={LINE} calcMode="spline" keyPoints="0;1" keyTimes="0;1" keySplines={EASE} />
                </g>
              )}
          </g>
        </svg>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#122a1e] to-transparent" />
      </div>
    </aside>
  );
}

function Marker({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r="12" fill="#8fd3aa" className="brand-ping" />
      <circle r="7.5" fill="#8fd3aa" fillOpacity="0.18" />
      <circle r="3.75" fill="#ecfff3" stroke="#7fc29b" strokeWidth="1.75" />
    </g>
  );
}
