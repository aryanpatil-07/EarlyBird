/**
 * SLA Badge Component
 * Displays SLA status with color coding and remaining time
 */

import React, { useEffect, useState } from 'react';
import { Badge } from '../ui/Badge.tsx';
import { SLA_WINDOW_MS } from '../../lib/constants.ts';

interface SLABadgeProps {
  createdAt: string;
}

export const SLABadge: React.FC<SLABadgeProps> = ({ createdAt }) => {
  const [remaining, setRemaining] = useState<string>('');
  const [variant, setVariant] = useState<'warning' | 'destructive' | 'success'>('success');

  useEffect(() => {
    const calculateSLA = () => {
      const created = new Date(createdAt).getTime();
      const now = Date.now();
      const elapsed = now - created;
      const remainingMs = Math.max(0, SLA_WINDOW_MS - elapsed);

      // Determine variant
      if (remainingMs === 0) {
        setVariant('destructive');
      } else if (remainingMs < 60 * 60 * 1000) {
        setVariant('destructive');
      } else if (remainingMs < 2 * 60 * 60 * 1000) {
        setVariant('warning');
      } else {
        setVariant('success');
      }

      // Format remaining time
      const hours = Math.floor(remainingMs / (60 * 60 * 1000));
      const mins = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));
      setRemaining(`${hours}h ${mins}m`);
    };

    calculateSLA();
    const interval = setInterval(calculateSLA, 30000); // Update every 30s

    return () => clearInterval(interval);
  }, [createdAt]);

  const variantMap = {
    success: 'success',
    warning: 'warning',
    destructive: 'destructive',
  } as const;

  return (
    <Badge variant={variantMap[variant]}>
      {remaining}
    </Badge>
  );
};
