'use client';

import { motion, useReducedMotion, type Variants } from 'framer-motion';
import type { ReactNode } from 'react';

type RevealProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
  /** Elementets startläge. "up" är standard för sektioner, "none" för rena toningar. */
  from?: 'up' | 'down' | 'left' | 'right' | 'none';
  as?: 'div' | 'section' | 'li' | 'span';
};

const OFFSET = 22;

export function Reveal({ children, className, delay = 0, from = 'up', as = 'div' }: RevealProps) {
  const reduced = useReducedMotion();
  const Component = motion[as];

  const variants: Variants = {
    hidden: {
      opacity: 0,
      x: reduced || from === 'none' ? 0 : from === 'left' ? OFFSET : from === 'right' ? -OFFSET : 0,
      y: reduced || from === 'none' ? 0 : from === 'up' ? OFFSET : from === 'down' ? -OFFSET : 0,
    },
    visible: { opacity: 1, x: 0, y: 0 },
  };

  return (
    <Component
      // data-reveal gör att innehållet kan visas ändå om JavaScript är avstängt (se layout.tsx).
      data-reveal=""
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-80px' }}
      variants={variants}
      transition={{ duration: 0.6, delay, ease: [0.22, 0.61, 0.36, 1] }}
    >
      {children}
    </Component>
  );
}

type RevealGroupProps = {
  children: ReactNode;
  className?: string;
  stagger?: number;
};

/** Förälder som låter barnen tonas in i tur och ordning. */
export function RevealGroup({ children, className, stagger = 0.08 }: RevealGroupProps) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-60px' }}
      variants={{ hidden: {}, visible: { transition: { staggerChildren: stagger } } }}
    >
      {children}
    </motion.div>
  );
}

export function RevealItem({ children, className }: { children: ReactNode; className?: string }) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      data-reveal=""
      className={className}
      variants={{
        hidden: { opacity: 0, y: reduced ? 0 : 18 },
        visible: { opacity: 1, y: 0 },
      }}
      transition={{ duration: 0.5, ease: [0.22, 0.61, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
