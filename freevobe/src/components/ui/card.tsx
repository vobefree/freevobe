import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export function Card({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'vf-panel relative overflow-hidden p-6 transition-colors duration-300 hover:border-accent/40',
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('mb-3 flex items-center gap-3', className)} {...props} />;
}

export function CardTitle({ className, ...props }: ComponentProps<'h3'>) {
  return <h3 className={cn('text-base font-semibold tracking-tight', className)} {...props} />;
}

export function CardBody({ className, ...props }: ComponentProps<'p'>) {
  return <p className={cn('text-sm leading-relaxed text-muted', className)} {...props} />;
}

export function CardIcon({ className, ...props }: ComponentProps<'span'>) {
  return (
    <span
      className={cn(
        'flex size-10 items-center justify-center rounded-xl border border-line bg-card-strong text-accent-soft',
        className,
      )}
      {...props}
    />
  );
}
