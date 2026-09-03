import { useEffect, useMemo, useState, type MouseEvent } from 'react';
import { BookOpen } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { brokerFromProfile } from '../components/plugin/ConnectBrokerForm';
import { buildGuide } from './docsGuide';

function scrollParent(el: HTMLElement | null): HTMLElement | null {
  let node = el?.parentElement ?? null;
  while (node) {
    const { overflowY } = getComputedStyle(node);
    if (overflowY === 'auto' || overflowY === 'scroll') return node;
    node = node.parentElement;
  }
  return null;
}

export default function DocsPage() {
  const { user } = useAuth();
  const broker = brokerFromProfile(user?.broker);
  const linked = Boolean(user?.broker);
  const { name, sections } = useMemo(() => buildGuide(broker, linked), [broker, linked]);
  const [active, setActive] = useState(sections[0]?.id ?? 'intro');
  const activeIndex = Math.max(0, sections.findIndex((s) => s.id === active));

  useEffect(() => {
    const nodes = sections
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => el != null);
    if (nodes.length === 0) return;

    const root = scrollParent(nodes[0]);
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        const id = visible[0]?.target.id;
        if (id) setActive(id);
      },
      { root, rootMargin: '-16% 0px -70% 0px', threshold: [0, 0.15, 0.4, 0.7] },
    );
    nodes.forEach((n) => obs.observe(n));
    return () => obs.disconnect();
  }, [sections]);

  const jumpTo = (id: string) => (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (!el) return;
    const root = scrollParent(el);
    setActive(id);
    if (!root) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    const top = el.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop - 20;
    root.scrollTo({ top, behavior: 'smooth' });
  };

  const spinePct = sections.length > 1
    ? ((activeIndex + 0.55) / sections.length) * 100
    : 100;

  return (
    <div className="docs-page pb-16">
      <header className="docs-hero">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 max-w-2xl">
            <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
              <BookOpen className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden="true" />
              Desk guide
            </p>
            <h1 className="mt-2.5 text-[28px] font-bold leading-[1.15] tracking-tight text-slate-900 sm:text-[32px]">
              {name}
            </h1>
            <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-slate-500">
              {linked
                ? `The working manual for this terminal — connect, start, read logs, and stop without guesswork. Jump from the index; the chapter you are in stays marked as you scroll.`
                : 'Sign in with a Mintzy API key that has a broker linked to see the matching connect steps.'}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <span className="inline-flex items-center rounded-full border border-emerald-200/80 bg-white/80 px-3 py-1 text-[12px] font-semibold text-emerald-800 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
              {name}
            </span>
            <p className="text-[11px] font-medium tabular-nums text-slate-400">
              {sections.length} chapters
            </p>
          </div>
        </div>
        <p className="docs-tape" aria-hidden="true">
          <span>Guide</span>
          <span className="docs-tape-dot" />
          <span>{name}</span>
          <span className="docs-tape-dot" />
          <span>Index on the left</span>
          <span className="docs-tape-dot" />
          <span>Written for this broker only</span>
        </p>
      </header>

      <div className="mt-4 flex gap-8 lg:gap-10">
        <nav
          aria-label="Guide index"
          className="docs-index sticky top-0 hidden h-fit max-h-[calc(100vh-6rem)] w-[15.25rem] shrink-0 overflow-y-auto md:block"
        >
          <p className="px-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">On this page</p>
          <div className="relative mt-3">
            <span className="pointer-events-none absolute left-[9px] top-2 bottom-2 w-px bg-slate-200/90" aria-hidden="true" />
            <span
              className="pointer-events-none absolute left-[9px] top-2 w-px bg-emerald-500 transition-[height] duration-300 ease-out"
              style={{ height: `calc(${spinePct}% - 0.5rem)` }}
              aria-hidden="true"
            />
            <ul className="space-y-0.5">
              {sections.map((s, i) => {
                const isActive = active === s.id;
                return (
                  <li key={s.id}>
                    <a
                      href={`#${s.id}`}
                      aria-current={isActive ? 'location' : undefined}
                      onClick={jumpTo(s.id)}
                      className={`group relative flex items-start gap-2.5 rounded-xl py-1.5 pr-2.5 pl-0 text-[12.5px] leading-snug transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30 ${
                        isActive
                          ? 'font-semibold text-emerald-900'
                          : 'font-medium text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      <span
                        className={`relative z-[1] mt-[5px] ml-[5px] h-[9px] w-[9px] shrink-0 rounded-full border-2 bg-white transition-colors ${
                          isActive
                            ? 'border-emerald-600 bg-emerald-600 shadow-[0_0_0_3px_rgba(16,185,129,0.18)]'
                            : 'border-slate-300 group-hover:border-slate-400'
                        }`}
                        aria-hidden="true"
                      />
                      <span className={`min-w-0 rounded-lg px-2 py-1 ${isActive ? 'bg-emerald-50' : 'group-hover:bg-slate-100/80'}`}>
                        <span className="sr-only">Chapter {i + 1}. </span>
                        {s.title}
                      </span>
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        </nav>

        <div className="min-w-0 max-w-[54rem] flex-1">
          <div className="docs-mobile-index md:hidden">
            {sections.map((s) => {
              const isActive = active === s.id;
              return (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  aria-current={isActive ? 'location' : undefined}
                  onClick={jumpTo(s.id)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                    isActive
                      ? 'bg-emerald-700 text-white'
                      : 'border border-slate-200 bg-white text-slate-600 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800'
                  }`}
                >
                  {s.title}
                </a>
              );
            })}
          </div>

          <div className="flex flex-col gap-5">
            {sections.map((s) => (
              <article key={s.id} id={s.id} className="docs-sheet scroll-mt-5">
                <h2 className="docs-sheet-title">{s.title}</h2>
                <div className="docs-body mt-6">
                  {s.body}
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
