import { cn } from '@/lib/utils';
import { HTMLAttributes, InputHTMLAttributes, forwardRef } from 'react';

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'bg-surface border border-border rounded-card p-5 hover:border-border/80',
        className
      )}
      {...props}
    />
  );
}

export function Badge({
  className,
  variant = 'default',
  children,
  ...props
}: HTMLAttributes<HTMLSpanElement> & {
  variant?: 'default' | 'open' | 'closed' | 'finished' | 'accent' | 'gold' | 'danger';
}) {
  const variants = {
    default: 'bg-surface-2 text-text-muted border border-border',
    open: 'bg-accent/15 text-accent border border-accent/30',
    closed: 'bg-zinc-700/40 text-zinc-400 border border-zinc-600',
    finished: 'bg-surface-2 text-text-muted border border-border',
    accent: 'bg-accent text-black',
    gold: 'bg-gold text-black',
    danger: 'bg-danger/15 text-danger border border-danger/30',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full uppercase tracking-wide',
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          'bg-surface-2 border border-border rounded-lg px-3 py-2 text-text placeholder:text-text-muted',
          'focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20',
          'transition-colors',
          className
        )}
        {...props}
      />
    );
  }
);

export function PulseDot({ className }: { className?: string }) {
  return (
    <span className={cn('relative inline-flex h-2 w-2', className)}>
      <span className="absolute inline-flex h-full w-full rounded-full bg-accent opacity-75 animate-pulse-dot" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
    </span>
  );
}

export function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  const initial = (name?.[0] ?? '?').toUpperCase();
  return (
    <div
      className="rounded-full bg-gradient-to-br from-accent to-accent-dark text-black font-display font-bold flex items-center justify-center flex-shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initial}
    </div>
  );
}
