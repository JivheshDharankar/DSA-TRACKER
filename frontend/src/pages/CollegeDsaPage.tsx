import React, { useState } from 'react';
import { LayoutGrid, Table as TableIcon, Loader2, AlertCircle } from 'lucide-react';
import { useProblems } from '../hooks/useProblems';
import { Problem } from '../types';
import { ProblemFilterBar } from '../components/problems/ProblemFilterBar';
import { ProblemTable } from '../components/problems/ProblemTable';
import { ProblemCardList } from '../components/problems/ProblemCardList';
import { Pagination } from '../components/problems/Pagination';
import { ProblemModal } from '../components/problems/ProblemModal';
import { DeleteProblemDialog } from '../components/problems/DeleteProblemDialog';
import { ProblemEmptyState } from '../components/problems/ProblemEmptyState';
import styles from '../styles/TrackerPage.module.css';

export const CollegeDsaPage: React.FC = () => {
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
  } = useProblems('COLLEGE');

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
      <div className={styles.pageHeader}>
        <div className={styles.headerInfo}>
          <h2 className={styles.pageTitle}>College DSA Tracker</h2>
          <p className={styles.pageSubtitle}>
            Track problems learned across lectures, assignments, labs, and semester exams with
            isolated S.No sequencing.
          </p>
        </div>

        <div className={styles.viewModeToggle}>
          <button
            onClick={() => setViewMode('table')}
            className={`${styles.viewBtn} ${viewMode === 'table' ? styles.viewBtnActive : ''}`}
            title="Table view"
          >
            <TableIcon size={16} />
          </button>
          <button
            onClick={() => setViewMode('cards')}
            className={`${styles.viewBtn} ${viewMode === 'cards' ? styles.viewBtnActive : ''}`}
            title="Card view"
          >
            <LayoutGrid size={16} />
          </button>
        </div>
      </div>

      <ProblemFilterBar
        section="COLLEGE"
        filters={filters}
        onFilterChange={updateFilters}
        onResetFilters={resetFilters}
        onOpenCreateModal={handleOpenCreate}
      />

      {error && (
        <div className={styles.errorBanner}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {isLoading ? (
        <div className={styles.loadingSkeleton}>
          <Loader2 size={32} color="var(--accent-cyan)" className="animate-spin" />
          <span style={{ color: 'var(--text-muted)' }}>Loading College DSA problems...</span>
        </div>
      ) : problems.length === 0 ? (
        <ProblemEmptyState
          section="COLLEGE"
          hasFilters={hasActiveFilters}
          onClearFilters={resetFilters}
          onCreateProblem={handleOpenCreate}
        />
      ) : (
        <>
          {viewMode === 'table' ? (
            <ProblemTable
              problems={problems}
              section="COLLEGE"
              onEdit={handleOpenEdit}
              onDelete={handleOpenDelete}
            />
          ) : (
            <ProblemCardList
              problems={problems}
              section="COLLEGE"
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
        section="COLLEGE"
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
