import React from 'react';
import { LayoutGrid, Table as TableIcon } from 'lucide-react';
import { cx } from '../ui/cx';
import styles from '../../styles/TrackerPage.module.css';

/**
 * DSA Tracker — Tracker header band (Phase 6)
 * ===========================================
 * Title + subtitle on the left, the table/card view toggle on the right, sitting on top
 * of the toolbar-first layout. The heading stays a real `<h2>` carrying the exact
 * section title (the shell's `<h1>` and every existing heading assertion depend on it),
 * and the toggle keeps the `Table view` / `Card view` titles plus the `viewBtn` /
 * `viewBtnActive` class names its tests assert.
 */

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

      <div className={styles.viewModeToggle} role="group" aria-label="Problem view">
        <button
          type="button"
          onClick={() => onViewModeChange('table')}
          className={cx(styles.viewBtn, viewMode === 'table' && styles.viewBtnActive)}
          title="Table view"
          aria-pressed={viewMode === 'table'}
        >
          <TableIcon size={15} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => onViewModeChange('cards')}
          className={cx(styles.viewBtn, viewMode === 'cards' && styles.viewBtnActive)}
          title="Card view"
          aria-pressed={viewMode === 'cards'}
        >
          <LayoutGrid size={15} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};
