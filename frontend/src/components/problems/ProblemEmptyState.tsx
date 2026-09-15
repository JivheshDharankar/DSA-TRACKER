import React from 'react';
import { BookOpen, Plus } from 'lucide-react';
import { SectionType } from '../../types';
import styles from './ProblemEmptyState.module.css';

interface ProblemEmptyStateProps {
  section: SectionType;
  hasFilters: boolean;
  onClearFilters?: () => void;
  onCreateProblem: () => void;
}

export const ProblemEmptyState: React.FC<ProblemEmptyStateProps> = ({
  section,
  hasFilters,
  onClearFilters,
  onCreateProblem,
}) => {
  return (
    <div className={styles.emptyContainer}>
      <div className={styles.iconWrapper}>
        <BookOpen size={28} />
      </div>
      <h3 className={styles.title}>
        {hasFilters
          ? 'No matching problems found'
          : `No ${section === 'COLLEGE' ? 'College' : 'Personal'} DSA problems yet`}
      </h3>
      <p className={styles.description}>
        {hasFilters
          ? 'Try adjusting your search criteria or clear your current filters to view more problems.'
          : `Add your first ${
              section === 'COLLEGE'
                ? 'lecture or lab problem'
                : 'LeetCode or independent prep problem'
            } to start tracking with systematic S.No sequencing.`}
      </p>

      {hasFilters && onClearFilters ? (
        <button onClick={onClearFilters} className={styles.createBtn}>
          Clear All Filters
        </button>
      ) : (
        <button onClick={onCreateProblem} className={styles.createBtn}>
          <Plus size={16} />
          <span>Add Problem</span>
        </button>
      )}
    </div>
  );
};
