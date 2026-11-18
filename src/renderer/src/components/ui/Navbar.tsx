interface Props {
  title?: string;
  subtitle?: string;
  trailing?: React.ReactNode;
}

export default function Navbar({ title, subtitle, trailing }: Props) {
  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-line bg-surface px-6 ">
      <div className="min-w-0 flex-1">
        {title && (
          <h1 className="truncate font-serif text-2xl tracking-tight text-ink">{title}</h1>
        )}
        {subtitle && (
          <p className="mt-0.5 truncate text-[12px] leading-tight text-muted">{subtitle}</p>
        )}
      </div>
      {trailing}
    </header>
  );
}
