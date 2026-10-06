import React, { useState } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { useProblems } from '../../hooks/useProblems';
import { Problem, SectionType } from '../../types';
import { TrackerHeader } from './TrackerHeader';
import { ProblemFilterBar } from './ProblemFilterBar';
import { ProblemTable } from './ProblemTable';
import { ProblemCardList } from './ProblemCardList';
import { Pagination } from './Pagination';
import { ProblemModal } from './ProblemModal';
import { DeleteProblemDialog } from './DeleteProblemDialog';
import { ProblemEmptyState } from './ProblemEmptyState';
import styles from '../../styles/TrackerPage.module.css';

export interface TrackerPageProps {
  section: SectionType;
  title: string;
  subtitle: string;
  loadingMessage?: string;
}

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
  } = useProblems(section);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [problemToEdit, setProblemToEdit] = useState<Problem | null>(null);
  const [problemToDelete, setProblemToDelete] = useState<Problem | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

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
        onViewModeChange={setViewMode}
      />

      <ProblemFilterBar
        section={section}
        filters={filters}
        onFilterChange={updateFilters}
        onResetFilters={resetFilters}
        onOpenCreateModal={handleOpenCreate}
      />

      {error && (
        <div className={styles.errorBanner} role="alert">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {isLoading ? (
        <div className={styles.loadingSkeleton}>
          <Loader2 size={32} color="var(--accent-cyan)" className="animate-spin" />
          <span style={{ color: 'var(--text-muted)' }}>{loadingMessage}</span>
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
            onPageChange={(page) => updateFilters({ page })}
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
