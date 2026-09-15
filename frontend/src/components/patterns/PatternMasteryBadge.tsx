import React from 'react';
import { PatternMasteryLevel } from '../../types';
import styles from './PatternMasteryBadge.module.css';

interface PatternMasteryBadgeProps {
  level: PatternMasteryLevel;
  score?: number;
  size?: 'sm' | 'md' | 'lg';
  showScore?: boolean;
}

export const PatternMasteryBadge: React.FC<PatternMasteryBadgeProps> = ({
  level,
  score,
  size = 'md',
  showScore = true,
}) => {
  const levelClass = styles[level.toLowerCase()] || styles.learning;

  return (
    <span className={`${styles.badge} ${styles[size]} ${levelClass}`}>
      <span className={styles.dot} />
      <span>{level}</span>
      {showScore && score !== undefined && (
        <span className={styles.score}>({score}%)</span>
      )}
    </span>
  );
};
