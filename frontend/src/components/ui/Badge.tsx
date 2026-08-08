/**
 * Badge Component
 * Compact, refined pill display for status, state, tags
 * Styled for deep dark mode with subtle glowing borders
 */

import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-white/[0.06] text-slate-300 border border-white/[0.08]',
        primary: 'bg-sky-500/15 text-sky-300 border border-sky-500/30',
        secondary: 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30',
        success: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
        warning: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
        destructive: 'bg-rose-500/15 text-rose-300 border border-rose-500/30',
        outline: 'border border-white/10 text-slate-300 bg-transparent',
        // Case state variants
        new: 'bg-sky-500/15 text-sky-300 border border-sky-500/30',
        accepted: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
        resolved: 'bg-teal-500/15 text-teal-300 border border-teal-500/30',
        escalated: 'bg-rose-500/15 text-rose-300 border border-rose-500/30',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
