import React from 'react';
import { StatusType } from '../../types';
import styles from './Badges.module.css';

interface StatusBadgeProps {
  status: StatusType;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const getClassName = () => {
    switch (status) {
      case 'Not Started':
        return styles.statusNotStarted;
      case 'Attempted':
        return styles.statusAttempted;
      case 'Solved':
        return styles.statusSolved;
      default:
        return styles.statusNotStarted;
    }
  };

  return <span className={`${styles.badge} ${getClassName()}`}>{status}</span>;
};
