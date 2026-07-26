/**
 * Badge Component
 * Compact display for status, state, tags
 */

import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold',
  {
    variants: {
      variant: {
        default: 'bg-gray-700 text-gray-100',
        primary: 'bg-purple-600 text-white',
        secondary: 'bg-amber-500 text-white',
        success: 'bg-green-600 text-white',
        warning: 'bg-amber-600 text-white',
        destructive: 'bg-red-600 text-white',
        outline: 'border border-gray-400 text-gray-200',
        // Case state variants
        new: 'bg-blue-900 text-blue-200',
        accepted: 'bg-amber-900 text-amber-200',
        resolved: 'bg-green-900 text-green-200',
        escalated: 'bg-red-900 text-red-200',
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
