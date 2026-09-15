import React from 'react';
import { RecallResultType } from '../../types';
import styles from './RecallResultBadge.module.css';

interface RecallResultBadgeProps {
  result: RecallResultType;
}

export const RecallResultBadge: React.FC<RecallResultBadgeProps> = ({ result }) => {
  const getStyleClass = () => {
    switch (result) {
      case 'EASY':
        return styles.easy;
      case 'STRUGGLED':
        return styles.struggled;
      case 'HINT':
        return styles.hint;
      case 'FORGOT':
        return styles.forgot;
      default:
        return styles.easy;
    }
  };

  return <span className={`${styles.badge} ${getStyleClass()}`}>{result}</span>;
};
