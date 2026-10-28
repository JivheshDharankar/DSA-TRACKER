import React from 'react';
import { Lock, Unlock } from 'lucide-react';
import { MasteryStatus } from '../../types';
import { Badge } from '../ui/Badge';
import { masteryTone } from './badgeTones';

interface MasteryBadgeProps {
  status?: MasteryStatus;
  showUnlocked?: boolean;
}

/**
 * Proof-of-learning mastery pill — shared `Badge` primitive with the tracker tone mapping.
 *
 * Labels, glyphs and titles are unchanged: `LOCKED` renders the lock chip, and an
 * `UNLOCKED` problem only renders anything when `showUnlocked` is passed, which is what
 * keeps the tracker and Problem Detail quiet for the common case.
 */
export const MasteryBadge: React.FC<MasteryBadgeProps> = ({
  status = 'UNLOCKED',
  showUnlocked = false,
}) => {
  if (status === 'LOCKED') {
    return (
      <span title="Locked Problem — Long-Term Mastered">
        <Badge tone={masteryTone(status)} shape="pill">
          <Lock size={11} aria-hidden="true" />
          <span>Locked</span>
        </Badge>
      </span>
    );
  }

  if (showUnlocked) {
    return (
      <span title="Mastery In Progress">
        <Badge tone={masteryTone(status)} shape="pill">
          <Unlock size={11} aria-hidden="true" />
          <span>Unlocked</span>
        </Badge>
      </span>
    );
  }

  return null;
};
