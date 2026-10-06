import React from 'react';
import { LayoutGrid, Table as TableIcon } from 'lucide-react';
import styles from '../../styles/TrackerPage.module.css';

export interface TrackerHeaderProps {
  title: string;
  subtitle: string;
  viewMode: 'table' | 'cards';
  onViewModeChange: (mode: 'table' | 'cards') => void;
}

export const TrackerHeader: React.FC<TrackerHeaderProps> = ({
  title,
  subtitle,
  viewMode,
  onViewModeChange,
}) => {
  return (
    <div className={styles.pageHeader}>
      <div className={styles.headerInfo}>
        <h2 className={styles.pageTitle}>{title}</h2>
        <p className={styles.pageSubtitle}>{subtitle}</p>
      </div>

      <div className={styles.viewModeToggle}>
        <button
          onClick={() => onViewModeChange('table')}
          className={`${styles.viewBtn} ${viewMode === 'table' ? styles.viewBtnActive : ''}`}
          title="Table view"
          type="button"
        >
          <TableIcon size={16} />
        </button>
        <button
          onClick={() => onViewModeChange('cards')}
          className={`${styles.viewBtn} ${viewMode === 'cards' ? styles.viewBtnActive : ''}`}
          title="Card view"
          type="button"
        >
          <LayoutGrid size={16} />
        </button>
      </div>
    </div>
  );
};
