import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type ReactNode } from 'react';
const control = 'w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-muted disabled:cursor-not-allowed disabled:opacity-50';
export function Field({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string; children: ReactNode }) {
  return <div><label htmlFor={id} className="mb-2 block text-xs font-semibold text-secondary">{label}</label>{children}
    {(error || hint) && <p id={`${id}-description`} role={error ? 'alert' : undefined} className={`mt-2 text-xs ${error ? 'text-loss' : 'text-muted'}`}>{error || hint}</p>}
  </div>;
}
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className = '', ...props }, ref) {
  return <input ref={ref} className={`${control} ${className}`} {...props} />;
});
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className = '', ...props }, ref) {
  return <select ref={ref} className={`${control} ${className}`} {...props} />;
});
export function Toggle({ checked, label, onChange, disabled = false }: { checked: boolean; label: string; onChange: () => void; disabled?: boolean }) {
  return <button type="button" role="switch" aria-label={label} aria-checked={checked} disabled={disabled} onClick={onChange}
    className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${checked ? 'bg-brand' : 'bg-line'}`}>
    <span className={`absolute left-0 top-0.5 h-5 w-5 rounded-full bg-surface transition-transform ${checked ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
  </button>;
}
