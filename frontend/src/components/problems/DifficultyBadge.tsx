import React from 'react';
import { DifficultyType } from '../../types';
import styles from './Badges.module.css';

interface DifficultyBadgeProps {
  difficulty: DifficultyType;
}

export const DifficultyBadge: React.FC<DifficultyBadgeProps> = ({ difficulty }) => {
  const getClassName = () => {
    switch (difficulty) {
      case 'Easy':
        return styles.diffEasy;
      case 'Medium':
        return styles.diffMedium;
      case 'Hard':
        return styles.diffHard;
      default:
        return styles.diffEasy;
    }
  };

  return (
    <span className={`${styles.badge} ${getClassName()}`}>
      <span className={styles.dot} />
      <span>{difficulty}</span>
    </span>
  );
};
