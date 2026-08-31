import { useEffect, useMemo, useState } from 'react';
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
      { root, rootMargin: '-18% 0px -68% 0px', threshold: [0, 0.15, 0.4, 0.7] },
    );
    nodes.forEach((n) => obs.observe(n));
    return () => obs.disconnect();
  }, [sections]);

  return (
    <div className="flex gap-10 lg:gap-12">
      <nav
        aria-label="Guide index"
        className="sticky top-0 hidden h-fit max-h-[calc(100vh-5.5rem)] w-[13.75rem] shrink-0 overflow-y-auto py-1 md:block"
      >
        <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Index</p>
        <ul className="mt-2.5 space-y-0.5">
          {sections.map((s) => {
            const isActive = active === s.id;
            return (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  aria-current={isActive ? 'location' : undefined}
                  className={`group relative flex rounded-lg py-2 pl-3.5 pr-2.5 text-[13px] leading-snug transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30 ${
                    isActive
                      ? 'bg-emerald-50 font-semibold text-emerald-900'
                      : 'font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <span
                    className={`absolute left-0 top-2 bottom-2 w-0.5 rounded-full transition-colors ${
                      isActive ? 'bg-emerald-600' : 'bg-transparent group-hover:bg-slate-300'
                    }`}
                    aria-hidden="true"
                  />
                  {s.title}
                </a>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="min-w-0 max-w-[52rem] flex-1 pb-24">
        <header className="border-b border-slate-200 pb-7">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">User guide</p>
          <h1 className="mt-2 text-[26px] font-semibold tracking-tight text-slate-900">{name}</h1>
          <p className="mt-2.5 max-w-xl text-[14px] leading-relaxed text-slate-500">
            {linked
              ? `Every step and every message this app can show for ${name}. Use the index to jump — the active section stays marked as you scroll.`
              : 'Sign in with a Mintzy API key that has a broker linked to see the matching connect steps.'}
          </p>
        </header>

        <div className="mt-5 flex flex-wrap gap-1.5 md:hidden">
          {sections.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600 transition-colors hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800"
            >
              {s.title}
            </a>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-14">
          {sections.map((s) => (
            <article key={s.id} id={s.id} className="scroll-mt-5">
              <h2 className="border-b border-slate-200 pb-3.5 text-[18px] font-semibold tracking-tight text-slate-900">
                {s.title}
              </h2>
              <div className="docs-body mt-6">
                {s.body}
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
