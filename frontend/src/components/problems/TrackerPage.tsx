import React, { useState } from 'react';
import { useProblems } from '../../hooks/useProblems';
import { Problem, SectionType } from '../../types';
import { ErrorState } from '../ui/ErrorState';
import { SkeletonTable } from '../ui/Skeleton';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { MEDIA } from '../../styles/breakpoints';
import { TrackerHeader } from './TrackerHeader';
import { ProblemFilterBar } from './ProblemFilterBar';
import { ProblemTable } from './ProblemTable';
import { ProblemCardList } from './ProblemCardList';
import { Pagination } from './Pagination';
import { ProblemModal } from './ProblemModal';
import { DeleteProblemDialog } from './DeleteProblemDialog';
import { ProblemEmptyState } from './ProblemEmptyState';
import styles from '../../styles/TrackerPage.module.css';

/**
 * DSA Tracker — College & Personal tracker page (Phase 6)
 * ======================================================
 * One component, parameterised by `section`, exactly as before: the header band, the
 * toolbar, the list and pagination, the create/edit modal and the delete confirmation
 * are all still wired to `useProblems(section)` and its handlers unchanged.
 *
 * What changed is presentational and state-handling:
 *   - the toolbar is the first surface, and it owns search, filters and the create action;
 *   - loading renders the shared `SkeletonTable` (plus the section's loading message),
 *     so the page does not jump when data arrives;
 *   - a failed request renders `ErrorState` with a working **Retry** (`refreshProblems`)
 *     and can never fall through to the genuine-empty state;
 *   - the genuinely-empty and nothing-matched states still come from `ProblemEmptyState`
 *     with the same copy;
 *   - the default view is cards below 768px and the table otherwise, while the view
 *     toggle keeps working at every width (an explicit choice always wins).
 */

export interface TrackerPageProps {
  section: SectionType;
  title: string;
  subtitle: string;
  loadingMessage?: string;
}

type ViewMode = 'table' | 'cards';

export const TrackerPage: React.FC<TrackerPageProps> = ({
  section,
  title,
  subtitle,
  loadingMessage = `Loading ${section === 'COLLEGE' ? 'College' : 'Personal'} DSA problems...`,
}) => {
  const {
    problems,
    pagination,
    isLoading,
    error,
    filters,
    updateFilters,
    resetFilters,
    handleCreateProblem,
    handleUpdateProblem,
    handleDeleteProblem,
    refreshProblems,
  } = useProblems(section);

  const isMobile = useMediaQuery(MEDIA.mobile);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [problemToEdit, setProblemToEdit] = useState<Problem | null>(null);
  const [problemToDelete, setProblemToDelete] = useState<Problem | null>(null);
  /** `null` = follow the viewport; an explicit choice from the toggle always wins. */
  const [viewChoice, setViewChoice] = useState<ViewMode | null>(null);
  const viewMode: ViewMode = viewChoice ?? (isMobile ? 'cards' : 'table');

  const handleOpenCreate = () => {
    setProblemToEdit(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (prob: Problem) => {
    setProblemToEdit(prob);
    setIsModalOpen(true);
  };

  const handleOpenDelete = (prob: Problem) => {
    setProblemToDelete(prob);
  };

  /** Paging replaces the list, so the reader is returned to the top of it. */
  const handlePageChange = (page: number) => {
    updateFilters({ page });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const hasActiveFilters = Boolean(
    filters.search ||
      filters.difficulty ||
      filters.status ||
      filters.retentionLevel ||
      filters.masteryStatus ||
      filters.source
  );

  return (
    <div className={styles.pageContainer}>
      <TrackerHeader
        title={title}
        subtitle={subtitle}
        viewMode={viewMode}
        onViewModeChange={setViewChoice}
      />

      <ProblemFilterBar
        section={section}
        filters={filters}
        onFilterChange={updateFilters}
        onResetFilters={resetFilters}
        onOpenCreateModal={handleOpenCreate}
      />

      {error ? (
        <ErrorState
          variant="section"
          title="We couldn't load your problems"
          message={error}
          onRetry={refreshProblems}
          retryLabel="Retry"
        />
      ) : isLoading ? (
        <div className={styles.loadingState}>
          <p className={styles.loadingCaption}>{loadingMessage}</p>
          <SkeletonTable rows={5} cells={viewMode === 'table' ? 6 : 3} label="Loading problems" />
        </div>
      ) : problems.length === 0 ? (
        <ProblemEmptyState
          section={section}
          hasFilters={hasActiveFilters}
          onClearFilters={resetFilters}
          onCreateProblem={handleOpenCreate}
        />
      ) : (
        <>
          {viewMode === 'table' ? (
            <ProblemTable
              problems={problems}
              section={section}
              onEdit={handleOpenEdit}
              onDelete={handleOpenDelete}
            />
          ) : (
            <ProblemCardList
              problems={problems}
              section={section}
              onEdit={handleOpenEdit}
              onDelete={handleOpenDelete}
            />
          )}

          <Pagination
            meta={pagination}
            onPageChange={handlePageChange}
            itemLabel="problems"
            label="Problem list pagination"
          />
        </>
      )}

      <ProblemModal
        isOpen={isModalOpen}
        section={section}
        problemToEdit={problemToEdit}
        onClose={() => setIsModalOpen(false)}
        onSubmitCreate={handleCreateProblem}
        onSubmitUpdate={handleUpdateProblem}
      />

      <DeleteProblemDialog
        isOpen={Boolean(problemToDelete)}
        problem={problemToDelete}
        onClose={() => setProblemToDelete(null)}
        onConfirmDelete={handleDeleteProblem}
      />
    </div>
  );
};
