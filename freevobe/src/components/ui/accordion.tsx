'use client';

import * as AccordionPrimitive from '@radix-ui/react-accordion';
import { Plus } from 'lucide-react';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export const Accordion = AccordionPrimitive.Root;

export function AccordionItem({
  className,
  ...props
}: ComponentProps<typeof AccordionPrimitive.Item>) {
  return (
    <AccordionPrimitive.Item
      className={cn(
        'group border-b border-line last:border-b-0 data-[state=open]:border-accent/40',
        className,
      )}
      {...props}
    />
  );
}

export function AccordionTrigger({
  className,
  children,
  ...props
}: ComponentProps<typeof AccordionPrimitive.Trigger>) {
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        className={cn(
          'flex flex-1 cursor-pointer items-center justify-between gap-6 py-5 text-left text-base font-medium text-fg transition-colors hover:text-accent-soft sm:text-lg',
          className,
        )}
        {...props}
      >
        {children}
        <Plus
          aria-hidden
          className="size-4 shrink-0 text-muted transition-transform duration-300 group-data-[state=open]:rotate-45 group-data-[state=open]:text-accent"
        />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  );
}

export function AccordionContent({
  className,
  children,
  ...props
}: ComponentProps<typeof AccordionPrimitive.Content>) {
  return (
    <AccordionPrimitive.Content
      className="overflow-hidden text-sm data-[state=closed]:animate-[accordion-up_0.22s_ease] data-[state=open]:animate-[accordion-down_0.22s_ease]"
      {...props}
    >
      <p className={cn('max-w-2xl pr-8 pb-6 leading-relaxed text-muted', className)}>{children}</p>
    </AccordionPrimitive.Content>
  );
}
