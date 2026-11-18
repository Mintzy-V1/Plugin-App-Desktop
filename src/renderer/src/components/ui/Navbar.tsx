import MarketClock from './MarketClock';

interface Props {
  title?: string;
  subtitle?: string;
  trailing?: React.ReactNode;
}

/** Slim app toolbar: where you are on the left, market context on the right. */
export default function Navbar({ title, subtitle, trailing }: Props) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-surface/90 px-6 backdrop-blur">
      <div className="flex min-w-0 flex-1 items-baseline gap-2.5">
        {title && <h1 className="truncate text-[15px] font-semibold tracking-tight text-ink">{title}</h1>}
        {subtitle && (
          <>
            <span className="text-line" aria-hidden="true">/</span>
            <p className="truncate text-[13px] text-muted">{subtitle}</p>
          </>
        )}
      </div>
      {trailing}
      <MarketClock />
    </header>
  );
}
