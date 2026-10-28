import React, { useState } from 'react';
import { Search, Plus, X, RotateCcw, SlidersHorizontal } from 'lucide-react';
import {
  SectionType,
  DifficultyType,
  StatusType,
  RetentionType,
  MasteryStatus,
  COLLEGE_SOURCES,
  PERSONAL_SOURCES,
  ProblemQueryParams,
} from '../../types';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { MEDIA } from '../../styles/breakpoints';
import styles from './ProblemFilterBar.module.css';

/**
 * DSA Tracker — Tracker toolbar (Phase 6)
 * ======================================
 * Search, the six filters and the create action, presented as one toolbar card.
 *
 * Every filter stays a **native `<select>`** (the Phase 2 `Select` primitive is exactly
 * that: a real select with a reset appearance), because the end-to-end suite drives
 * `selectOption()` and the unit tests read `getByDisplayValue` / `getByRole('option')`.
 * The option values, the "All …" labels, the sort combinations and the `Reset all
 * filters` control are unchanged.
 *
 * Below the mobile breakpoint the filter controls move into the Phase 2 `Dialog`
 * (bottom sheet under 640px, focus trap, Escape and scroll lock included), reachable
 * from a `Filters` button. The controls are one element tree rendered in either
 * container, and their values always come from `filters`, so a selected filter is still
 * selected when the drawer is reopened.
 */

interface ProblemFilterBarProps {
  section: SectionType;
  filters: ProblemQueryParams;
  onFilterChange: (newFilters: Partial<ProblemQueryParams>) => void;
  onResetFilters: () => void;
  onOpenCreateModal: () => void;
}

export const ProblemFilterBar: React.FC<ProblemFilterBarProps> = ({
  section,
  filters,
  onFilterChange,
  onResetFilters,
  onOpenCreateModal,
}) => {
  const sources = section === 'COLLEGE' ? COLLEGE_SOURCES : PERSONAL_SOURCES;
  const isMobile = useMediaQuery(MEDIA.mobile);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const hasActiveFilters = Boolean(
    filters.search ||
      filters.difficulty ||
      filters.status ||
      filters.retentionLevel ||
      filters.masteryStatus ||
      filters.source ||
      (filters.sortBy && filters.sortBy !== 'sNo')
  );

  /** Counts the filters that live inside the drawer, for its button badge. */
  const activeFilterCount = [
    filters.difficulty,
    filters.status,
    filters.retentionLevel,
    filters.masteryStatus,
    filters.source,
    filters.sortBy && filters.sortBy !== 'sNo' ? filters.sortBy : undefined,
  ].filter(Boolean).length;

  const searchField = (
    <div className={styles.searchWrapper}>
      <Search size={15} className={styles.searchIcon} aria-hidden="true" />
      <Input
        type="text"
        size="compact"
        className={styles.searchInput}
        placeholder="Search problems by title or topic..."
        aria-label="Search problems by title or topic"
        value={filters.search || ''}
        onChange={(e) => onFilterChange({ search: e.target.value, page: 1 })}
      />
      {filters.search && (
        <button
          type="button"
          onClick={() => onFilterChange({ search: '', page: 1 })}
          className={styles.clearSearchBtn}
          title="Clear search"
          aria-label="Clear search"
        >
          <X size={15} aria-hidden="true" />
        </button>
      )}
    </div>
  );

  const filterControls = (
    <>
      <div className={styles.field}>
        <Select
          size="compact"
          aria-label="Difficulty"
          value={filters.difficulty || ''}
          onChange={(e) =>
            onFilterChange({
              difficulty: (e.target.value as DifficultyType) || undefined,
              page: 1,
            })
          }
        >
          <option value="">All Difficulties</option>
          <option value="Easy">Easy</option>
          <option value="Medium">Medium</option>
          <option value="Hard">Hard</option>
        </Select>
      </div>

      <div className={styles.field}>
        <Select
          size="compact"
          aria-label="Status"
          value={filters.status || ''}
          onChange={(e) =>
            onFilterChange({
              status: (e.target.value as StatusType) || undefined,
              page: 1,
            })
          }
        >
          <option value="">All Statuses</option>
          <option value="Not Started">Not Started</option>
          <option value="Attempted">Attempted</option>
          <option value="Solved">Solved</option>
        </Select>
      </div>

      <div className={styles.field}>
        <Select
          size="compact"
          aria-label="Retention level"
          value={filters.retentionLevel || ''}
          onChange={(e) =>
            onFilterChange({
              retentionLevel: (e.target.value as RetentionType) || undefined,
              page: 1,
            })
          }
        >
          <option value="">All Retention Levels</option>
          <option value="Learning">Learning</option>
          <option value="Familiar">Familiar</option>
          <option value="Independent">Independent</option>
          <option value="Strong">Strong</option>
          <option value="Locked">Locked</option>
        </Select>
      </div>

      <div className={styles.field}>
        <Select
          size="compact"
          aria-label="Mastery"
          value={filters.masteryStatus || ''}
          onChange={(e) =>
            onFilterChange({
              masteryStatus: (e.target.value as MasteryStatus) || undefined,
              page: 1,
            })
          }
        >
          <option value="">All Mastery</option>
          <option value="LOCKED">Locked Only</option>
          <option value="UNLOCKED">Unlocked Only</option>
        </Select>
      </div>

      <div className={styles.field}>
        <Select
          size="compact"
          aria-label="Source"
          value={filters.source || ''}
          onChange={(e) =>
            onFilterChange({
              source: e.target.value || undefined,
              page: 1,
            })
          }
        >
          <option value="">All Sources</option>
          {sources.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
      </div>

      <div className={styles.field}>
        <Select
          size="compact"
          aria-label="Sort"
          value={`${filters.sortBy || 'sNo'}_${filters.sortOrder || 'asc'}`}
          onChange={(e) => {
            const [sortBy, sortOrder] = e.target.value.split('_') as [
              ProblemQueryParams['sortBy'],
              ProblemQueryParams['sortOrder']
            ];
            onFilterChange({ sortBy, sortOrder, page: 1 });
          }}
        >
          <option value="sNo_asc">Sort: S.No (Ascending)</option>
          <option value="sNo_desc">Sort: S.No (Descending)</option>
          <option value="dateLearned_desc">Sort: Date Learned (Newest)</option>
          <option value="dateLearned_asc">Sort: Date Learned (Oldest)</option>
          <option value="title_asc">Sort: Title (A-Z)</option>
        </Select>
      </div>

      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          type="button"
          onClick={onResetFilters}
          title="Reset all filters"
          iconLeft={<RotateCcw size={14} aria-hidden="true" />}
        >
          Reset Filters
        </Button>
      )}
    </>
  );

  if (isMobile) {
    return (
      <div className={styles.toolbar}>
        <div className={styles.searchRow}>{searchField}</div>

        <div className={styles.mobileActions}>
          <Button
            variant="secondary"
            size="md"
            type="button"
            aria-expanded={isDrawerOpen}
            onClick={() => setIsDrawerOpen(true)}
            iconLeft={<SlidersHorizontal size={15} aria-hidden="true" />}
          >
            {activeFilterCount > 0 ? `Filters (${activeFilterCount})` : 'Filters'}
          </Button>
          <Button
            variant="primary"
            size="md"
            type="button"
            onClick={onOpenCreateModal}
            iconLeft={<Plus size={16} aria-hidden="true" />}
          >
            Add Problem
          </Button>
        </div>

        <Dialog
          open={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          title="Filters"
          description="Narrow the list by difficulty, status, retention, mastery, source or sort order."
        >
          <div className={styles.drawerBody} data-testid="tracker-filter-drawer">
            {filterControls}
          </div>
        </Dialog>
      </div>
    );
  }

  return (
    <div className={styles.toolbar}>
      <div className={styles.searchRow}>
        {searchField}
        <div className={styles.actions}>
          <Button
            variant="primary"
            size="md"
            type="button"
            onClick={onOpenCreateModal}
            iconLeft={<Plus size={16} aria-hidden="true" />}
          >
            Add Problem
          </Button>
        </div>
      </div>

      <div className={styles.filterRow}>{filterControls}</div>
    </div>
  );
};
