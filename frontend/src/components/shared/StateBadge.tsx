/**
 * State Badge Component
 * Displays case state with appropriate styling
 */

import React from 'react';
import { Badge } from '../ui/Badge';
import { CaseState } from '../../lib/constants';

interface StateBadgeProps {
  state: CaseState;
}

export const StateBadge: React.FC<StateBadgeProps> = ({ state }) => {
  const variantMap: Record<CaseState, 'new' | 'accepted' | 'resolved' | 'escalated'> = {
    [CaseState.NEW]: 'new',
    [CaseState.ACCEPTED]: 'accepted',
    [CaseState.RESOLVED]: 'resolved',
    [CaseState.ESCALATED]: 'escalated',
  };

  return <Badge variant={variantMap[state]}>{state}</Badge>;
};
