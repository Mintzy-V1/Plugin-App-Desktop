export function Tabs<T extends string>({ items, value, onChange, label }: { items: { id: T; label: string; count?: number }[]; value: T; onChange: (value: T) => void; label: string }) {
  const id = label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return <div role="tablist" aria-label={label} className="flex max-w-full gap-5 self-start overflow-x-auto border-b border-line">
    {items.map((item, i) => <button key={item.id} id={`${id}-tab-${item.id}`} aria-controls={`${id}-panel-${item.id}`} type="button" role="tab" aria-selected={item.id === value} tabIndex={item.id === value ? 0 : -1}
      onClick={() => onChange(item.id)} onKeyDown={e => {
        const index = e.key === 'ArrowRight' ? (i + 1) % items.length : e.key === 'ArrowLeft' ? (i - 1 + items.length) % items.length : e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : -1;
        if (index >= 0) { e.preventDefault(); onChange(items[index].id); (e.currentTarget.parentElement?.children[index] as HTMLButtonElement)?.focus(); }
      }}
      className={`flex shrink-0 items-center gap-2 border-b-2 px-1 py-3 text-sm font-medium ${item.id === value ? 'border-brand text-ink' : 'border-transparent text-muted hover:text-ink'}`}>
      {item.label}{item.count !== undefined && item.count > 0 && <span className="rounded bg-subtle px-1.5 py-0.5 text-xs tabular-nums text-secondary">{item.count}</span>}
    </button>)}
  </div>;
}
