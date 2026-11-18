import { forwardRef, type ButtonHTMLAttributes } from 'react';

const variants = {
  primary: 'border-transparent bg-primary text-on-primary hover:opacity-90',
  secondary: 'border-line bg-surface text-ink hover:bg-subtle',
  danger: 'border-transparent bg-loss-soft text-loss hover:brightness-95',
  ghost: 'border-transparent text-secondary hover:bg-subtle hover:text-ink',
} as const;
const sizes = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2.5 text-sm', icon: 'h-9 w-9 p-0 text-sm' } as const;
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
}
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({
  variant = 'primary', size = 'md', className = '', type = 'button', ...props
}, ref) {
  return <button ref={ref} type={type} className={`inline-flex items-center justify-center gap-2 rounded-lg border font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`} {...props} />;
});
export function IconButton({ 'aria-label': label, className = '', ...props }: ButtonProps & { 'aria-label': string }) {
  return <Button variant="ghost" size="icon" aria-label={label} title={label} className={className} {...props} />;
}
