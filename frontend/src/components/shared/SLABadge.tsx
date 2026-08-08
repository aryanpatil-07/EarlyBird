/**
 * SLA Badge Component
 * Displays SLA status with subtle color coding and countdown
 */

import React, { useEffect, useState } from 'react';
import { SLA_WINDOW_MS } from '../../lib/constants';

interface SLABadgeProps {
  createdAt: string;
}

export const SLABadge: React.FC<SLABadgeProps> = ({ createdAt }) => {
  const [remaining, setRemaining] = useState<string>('');
  const [urgency, setUrgency] = useState<'urgent' | 'warning' | 'normal'>('normal');

  useEffect(() => {
    const calculateSLA = () => {
      const created = new Date(createdAt).getTime();
      const now = Date.now();
      const elapsed = now - created;
      const remainingMs = Math.max(0, SLA_WINDOW_MS - elapsed);

      if (remainingMs === 0 || remainingMs < 60 * 60 * 1000) {
        setUrgency('urgent');
      } else if (remainingMs < 2 * 60 * 60 * 1000) {
        setUrgency('warning');
      } else {
        setUrgency('normal');
      }

      const hours = Math.floor(remainingMs / (60 * 60 * 1000));
      const mins = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));
      setRemaining(`${hours}h ${mins}m`);
    };

    calculateSLA();
    const interval = setInterval(calculateSLA, 15000);
    return () => clearInterval(interval);
  }, [createdAt]);

  const styleClasses = {
    urgent: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
    warning: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    normal: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  }[urgency];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-medium border tracking-tight ${styleClasses}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          urgency === 'urgent'
            ? 'bg-rose-400 animate-pulse'
            : urgency === 'warning'
            ? 'bg-amber-400'
            : 'bg-emerald-400'
        }`}
      />
      {remaining}
    </span>
  );
};
