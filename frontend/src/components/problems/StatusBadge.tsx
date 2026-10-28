import React from 'react';
import { StatusType } from '../../types';
import { Badge } from '../ui/Badge';
import { statusTone } from './badgeTones';

interface StatusBadgeProps {
  status: StatusType;
}

/** Status pill — shared `Badge` primitive and the tracker tone mapping. */
export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => (
  <Badge tone={statusTone(status)} shape="pill">
    {status}
  </Badge>
);
