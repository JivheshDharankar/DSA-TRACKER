import React from 'react';
import { Lock } from 'lucide-react';
import { RetentionType } from '../../types';
import styles from './Badges.module.css';

interface RetentionBadgeProps {
  retention: RetentionType;
}

export const RetentionBadge: React.FC<RetentionBadgeProps> = ({ retention }) => {
  const getClassName = () => {
    switch (retention) {
      case 'Learning':
        return styles.retentionLearning;
      case 'Familiar':
        return styles.retentionFamiliar;
      case 'Independent':
        return styles.retentionIndependent;
      case 'Strong':
        return styles.retentionStrong;
      case 'Locked':
        return styles.retentionLocked;
      default:
        return styles.retentionLearning;
    }
  };

  return (
    <span className={`${styles.badge} ${getClassName()}`}>
      {retention === 'Locked' && <Lock size={12} />}
      <span>{retention}</span>
    </span>
  );
};
