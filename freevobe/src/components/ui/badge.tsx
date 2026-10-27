import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export function Badge({ className, ...props }: ComponentProps<'span'>) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-full border border-line-strong bg-card/70 px-3 py-1 text-xs font-medium text-muted backdrop-blur',
        className,
      )}
      {...props}
    />
  );
}

export function StatusDot({ className }: { className?: string }) {
  return (
    <span className={cn('relative flex size-2', className)}>
      <span className="absolute inline-flex size-full animate-ping rounded-full bg-teal opacity-60" />
      <span className="relative inline-flex size-2 rounded-full bg-teal" />
    </span>
  );
}
