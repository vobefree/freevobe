import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-xl font-medium whitespace-nowrap transition-[transform,background-color,box-shadow,color] duration-200 disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary:
          'bg-accent text-white shadow-[0_10px_30px_-12px_rgba(124,58,237,0.9)] hover:-translate-y-0.5 hover:bg-accent-strong hover:shadow-[0_16px_40px_-14px_rgba(124,58,237,0.95)]',
        secondary:
          'border border-line-strong bg-card text-fg hover:-translate-y-0.5 hover:border-accent/60 hover:text-accent-soft',
        ghost: 'text-muted hover:bg-card hover:text-fg',
      },
      size: {
        sm: 'h-9 px-3.5 text-sm',
        md: 'h-11 px-5 text-sm',
        lg: 'h-13 px-7 text-base',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

type ButtonProps = ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean };

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ButtonProps) {
  const Component = asChild ? Slot : 'button';
  return <Component className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

export { buttonVariants };
