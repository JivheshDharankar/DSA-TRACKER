import React from 'react';
import { BookOpen, Plus } from 'lucide-react';
import { SectionType } from '../../types';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import styles from './ProblemEmptyState.module.css';

/**
 * DSA Tracker — Tracker empty presentation (Phase 6)
 * ==================================================
 * Thin wrapper that keeps the tracker's section-specific copy and hands the layout to
 * the shared `EmptyState` primitive, so the tracker no longer ships its own empty
 * markup. The copy, the two states (genuinely empty vs nothing matched) and the CTA
 * labels are byte-identical to the pre-Phase-6 component.
 *
 * Note: this component only ever renders when the request *succeeded* and returned no
 * rows — a failed request is the page's `ErrorState`, never this.
 */

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
  const sectionLabel = section === 'COLLEGE' ? 'College' : 'Personal';

  const showClearFilters = Boolean(hasFilters && onClearFilters);

  return (
    <EmptyState
      variant="full"
      titleAs="h3"
      className={styles.emptyState}
      icon={<BookOpen size={26} aria-hidden="true" />}
      title={hasFilters ? 'No matching problems found' : `No ${sectionLabel} DSA problems yet`}
      description={
        hasFilters
          ? 'Try adjusting your search criteria or clear your current filters to view more problems.'
          : `Add your first ${
              section === 'COLLEGE'
                ? 'lecture or lab problem'
                : 'LeetCode or independent prep problem'
            } to start tracking with systematic S.No sequencing.`
      }
      primaryAction={
        showClearFilters ? (
          <Button variant="secondary" size="md" onClick={onClearFilters}>
            Clear All Filters
          </Button>
        ) : (
          <Button
            variant="primary"
            size="md"
            iconLeft={<Plus size={16} aria-hidden="true" />}
            onClick={onCreateProblem}
          >
            Add Problem
          </Button>
        )
      }
    />
  );
};
