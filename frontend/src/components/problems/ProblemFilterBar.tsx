import React from 'react';
import { Search, Plus, X, RotateCcw } from 'lucide-react';
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
import styles from './ProblemFilterBar.module.css';

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

  const hasActiveFilters = Boolean(
    filters.search ||
      filters.difficulty ||
      filters.status ||
      filters.retentionLevel ||
      filters.masteryStatus ||
      filters.source ||
      (filters.sortBy && filters.sortBy !== 'sNo')
  );

  return (
    <div className={styles.filterContainer}>
      <div className={styles.topRow}>
        <div className={styles.searchWrapper}>
          <Search size={16} className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Search problems by title or topic..."
            value={filters.search || ''}
            onChange={(e) => onFilterChange({ search: e.target.value, page: 1 })}
            className={styles.searchInput}
          />
          {filters.search && (
            <button
              onClick={() => onFilterChange({ search: '', page: 1 })}
              className={styles.clearSearchBtn}
              title="Clear search"
            >
              <X size={16} />
            </button>
          )}
        </div>

        <div className={styles.actionGroup}>
          <button onClick={onOpenCreateModal} className={styles.addBtn}>
            <Plus size={18} />
            <span>Add Problem</span>
          </button>
        </div>
      </div>

      <div className={styles.bottomRow}>
        <select
          value={filters.difficulty || ''}
          onChange={(e) =>
            onFilterChange({
              difficulty: (e.target.value as DifficultyType) || undefined,
              page: 1,
            })
          }
          className={styles.filterSelect}
        >
          <option value="">All Difficulties</option>
          <option value="Easy">Easy</option>
          <option value="Medium">Medium</option>
          <option value="Hard">Hard</option>
        </select>

        <select
          value={filters.status || ''}
          onChange={(e) =>
            onFilterChange({
              status: (e.target.value as StatusType) || undefined,
              page: 1,
            })
          }
          className={styles.filterSelect}
        >
          <option value="">All Statuses</option>
          <option value="Not Started">Not Started</option>
          <option value="Attempted">Attempted</option>
          <option value="Solved">Solved</option>
        </select>

        <select
          value={filters.retentionLevel || ''}
          onChange={(e) =>
            onFilterChange({
              retentionLevel: (e.target.value as RetentionType) || undefined,
              page: 1,
            })
          }
          className={styles.filterSelect}
        >
          <option value="">All Retention Levels</option>
          <option value="Learning">Learning</option>
          <option value="Familiar">Familiar</option>
          <option value="Independent">Independent</option>
          <option value="Strong">Strong</option>
          <option value="Locked">Locked</option>
        </select>

        <select
          value={filters.masteryStatus || ''}
          onChange={(e) =>
            onFilterChange({
              masteryStatus: (e.target.value as MasteryStatus) || undefined,
              page: 1,
            })
          }
          className={styles.filterSelect}
        >
          <option value="">All Mastery</option>
          <option value="LOCKED">Locked Only</option>
          <option value="UNLOCKED">Unlocked Only</option>
        </select>

        <select
          value={filters.source || ''}
          onChange={(e) =>
            onFilterChange({
              source: e.target.value || undefined,
              page: 1,
            })
          }
          className={styles.filterSelect}
        >
          <option value="">All Sources</option>
          {sources.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <select
          value={`${filters.sortBy || 'sNo'}_${filters.sortOrder || 'asc'}`}
          onChange={(e) => {
            const [sortBy, sortOrder] = e.target.value.split('_') as [
              ProblemQueryParams['sortBy'],
              ProblemQueryParams['sortOrder']
            ];
            onFilterChange({ sortBy, sortOrder, page: 1 });
          }}
          className={styles.filterSelect}
        >
          <option value="sNo_asc">Sort: S.No (Ascending)</option>
          <option value="sNo_desc">Sort: S.No (Descending)</option>
          <option value="dateLearned_desc">Sort: Date Learned (Newest)</option>
          <option value="dateLearned_asc">Sort: Date Learned (Oldest)</option>
          <option value="title_asc">Sort: Title (A-Z)</option>
        </select>

        {hasActiveFilters && (
          <button onClick={onResetFilters} className={styles.resetBtn} title="Reset all filters">
            <RotateCcw size={14} />
            <span>Reset Filters</span>
          </button>
        )}
      </div>
    </div>
  );
};

