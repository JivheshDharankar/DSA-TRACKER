import React from 'react';
import { Lock } from 'lucide-react';
import { RetentionType } from '../../types';
import { Badge } from '../ui/Badge';
import { retentionTone } from './badgeTones';

interface RetentionBadgeProps {
  retention: RetentionType;
}

/**
 * Retention pill — shared `Badge` primitive and the tracker tone mapping. The `Locked`
 * step keeps its lock glyph, and that glyph is the state carrier so the chip never relies
 * on colour alone.
 */
export const RetentionBadge: React.FC<RetentionBadgeProps> = ({ retention }) => (
  <Badge tone={retentionTone(retention)} shape="pill">
    {retention === 'Locked' ? (
      <>
        <Lock size={11} aria-hidden="true" />
        <span>Locked</span>
      </>
    ) : (
      retention
    )}
  </Badge>
);
