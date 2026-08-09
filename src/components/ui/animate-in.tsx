import { motion } from 'motion/react';
import type * as React from 'react';

type AnimateInProps = {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  direction?: 'up' | 'left' | 'none';
  duration?: number;
};

export function AnimateIn({
  children,
  className,
  delay = 0,
  direction = 'up',
  duration = 0.5
}: AnimateInProps) {
  const initial = {
    opacity: 0,
    y: direction === 'up' ? 24 : 0,
    x: direction === 'left' ? 24 : 0
  };

  return (
    <motion.div
      className={className}
      initial={initial}
      transition={{ duration, delay, ease: [0.21, 0.47, 0.32, 0.98] }}
      viewport={{ once: true, margin: '-60px' }}
      whileInView={{ opacity: 1, y: 0, x: 0 }}
    >
      {children}
    </motion.div>
  );
}
