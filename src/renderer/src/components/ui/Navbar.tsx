interface Props {
  title?: string;
  subtitle?: string;
  trailing?: React.ReactNode;
}

export default function Navbar({ title, subtitle, trailing }: Props) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-200/70 bg-white/80 px-6 backdrop-blur-md">
      <div className="min-w-0 flex-1">
        {title && (
          <h1 className="truncate text-[15px] font-semibold tracking-tight text-slate-900">{title}</h1>
        )}
        {subtitle && (
          <p className="mt-0.5 truncate text-[12px] leading-tight text-slate-500">{subtitle}</p>
        )}
      </div>
      {trailing}
    </header>
  );
}
