import React from 'react';
import { Lock, Unlock } from 'lucide-react';
import { MasteryStatus } from '../../types';
import styles from './Badges.module.css';

interface MasteryBadgeProps {
  status?: MasteryStatus;
  showUnlocked?: boolean;
}

export const MasteryBadge: React.FC<MasteryBadgeProps> = ({
  status = 'UNLOCKED',
  showUnlocked = false,
}) => {
  if (status === 'LOCKED') {
    return (
      <span className={`${styles.badge} ${styles.masteryLocked}`} title="Locked Problem — Long-Term Mastered">
        <Lock size={12} />
        <span>Locked</span>
      </span>
    );
  }

  if (showUnlocked) {
    return (
      <span className={`${styles.badge} ${styles.masteryUnlocked}`} title="Mastery In Progress">
        <Unlock size={12} />
        <span>Unlocked</span>
      </span>
    );
  }

  return null;
};
