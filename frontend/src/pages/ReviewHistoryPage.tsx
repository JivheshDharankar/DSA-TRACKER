import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  History,
  ArrowRight,
  Loader2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { fetchUserReviewHistory } from '../api/reviews.api';
import { RevisionHistoryItem, PaginationMeta } from '../types';
import { RecallResultBadge } from '../components/reviews/RecallResultBadge';
import { DifficultyBadge } from '../components/problems/DifficultyBadge';
import { formatCalendarDate } from '../utils/date.utils';
import styles from './ReviewHistoryPage.module.css';

export const ReviewHistoryPage: React.FC = () => {
  const [items, setItems] = useState<RevisionHistoryItem[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(async (pageToLoad: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchUserReviewHistory(pageToLoad, 20);
      setItems(data.items);
      setPagination(data.pagination);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load review history.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory(1);
  }, [loadHistory]);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      loadHistory(newPage);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const formatLatenessText = (timingStatus: string, latenessDays: number) => {
    if (timingStatus === 'ON_TIME' || latenessDays === 0) {
      return 'On time';
    }
    if (timingStatus === 'LATE') {
      return latenessDays === 1 ? 'Late by 1 day' : `Late by ${latenessDays} days`;
    }
    if (timingStatus === 'EARLY') {
      return latenessDays === 1 ? 'Early by 1 day' : `Early by ${latenessDays} days`;
    }
    return 'On time';
  };

  const formatDuration = (seconds?: number | null) => {
    if (!seconds || seconds <= 0) return '—';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m === 0) return `${s}s`;
    return `${m}m ${s}s`;
  };

  // Filter out any review history entries whose referenced problem was deleted or orphaned
  const visibleItems = items.filter((rev) => {
    const rawProblem = (
      typeof rev.problem === 'object' && rev.problem !== null
        ? rev.problem
        : typeof rev.problemId === 'object' && rev.problemId !== null
          ? rev.problemId
          : null
    ) as Record<string, unknown> | null;

    const pid = (rawProblem?._id?.toString() || rawProblem?.id?.toString() || '') as string;
    const pTitle = (typeof rawProblem?.title === 'string' ? rawProblem.title.trim() : '') as string;

    return Boolean(rawProblem && pid && pTitle);
  });

  return (
    <div className={styles.pageContainer}>
      <header className={styles.header}>
        <div className={styles.titleArea}>
          <div className={styles.iconCircle}>
            <History size={22} color="var(--accent-cyan)" />
          </div>
          <div>
            <h1 className={styles.title}>Review History</h1>
            <p className={styles.subtitle}>
              Chronological log of your spaced repetition recall events and memory retention progress.
            </p>
          </div>
        </div>
        <div className={styles.totalBadge}>
          {pagination.total} {pagination.total === 1 ? 'Review' : 'Reviews'} Completed
        </div>
      </header>

      {error && (
        <div className={styles.errorCard}>
          <AlertCircle size={20} color="#f87171" />
          <span>{error}</span>
          <button onClick={() => loadHistory(pagination.page)} className={styles.retryBtn}>
            Retry
          </button>
        </div>
      )}

      {isLoading ? (
        <div className={styles.loadingContainer}>
          <Loader2 size={36} className="animate-spin" color="var(--accent-cyan)" />
          <span style={{ color: 'var(--text-muted)' }}>Loading review log...</span>
        </div>
      ) : visibleItems.length === 0 ? (
        <div className={styles.emptyCard}>
          <div className={styles.emptyIcon}>
            <History size={36} color="var(--text-dim)" />
          </div>
          <h3 className={styles.emptyTitle}>No Reviews Completed Yet</h3>
          <p className={styles.emptyText}>
            When you complete spaced repetition sessions from your Review Queue, your review outcomes,
            timings, and stage transitions will be recorded here.
          </p>
          <Link to="/review" className={styles.primaryCta}>
            <span>Go to Review Queue</span>
          </Link>
        </div>
      ) : (
        <div className={styles.historyCard}>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th style={{ width: '80px' }}>S.No.</th>
                  <th>Problem</th>
                  <th>Recall Result</th>
                  <th>Cold Solve</th>
                  <th>Stage Transition</th>
                  <th>Timing</th>
                  <th>Reviewed At</th>
                  <th>Time Spent</th>
                </tr>
              </thead>
              <tbody>
                {visibleItems.map((rev) => {
                  const rawProblem = (
                    typeof rev.problem === 'object' && rev.problem !== null
                      ? rev.problem
                      : typeof rev.problemId === 'object' && rev.problemId !== null
                        ? rev.problemId
                        : null
                  ) as Record<string, unknown>;

                  const pid = (rawProblem._id?.toString() || rawProblem.id?.toString() || '') as string;
                  const pTitle = rawProblem.title as string;
                  const pSNo = rawProblem.sNo as number | undefined;
                  const pSection = rawProblem.section as string | undefined;
                  const pDiff = rawProblem.difficulty as 'Easy' | 'Medium' | 'Hard' | undefined;

                  // Stage transition: Only display Stage X → Stage Y if both are reliably present
                  const hasPrevious = rev.previousStage !== undefined && rev.previousStage !== null;
                  const hasNew = rev.newStage !== undefined && rev.newStage !== null;

                  return (
                    <tr key={rev.id} className={styles.tr}>
                      <td className={styles.sNoCell}>
                        {pSNo !== undefined ? (
                          <span className={styles.sNoBadge}>#{pSNo}</span>
                        ) : (
                          '—'
                        )}
                      </td>

                      <td className={styles.problemCell}>
                        <div className={styles.problemInfo}>
                          <Link to={`/problems/${pid}`} className={styles.problemLink}>
                            {pTitle}
                          </Link>
                          <div className={styles.pillRow}>
                            {pSection && (
                              <span className={styles.sectionPill}>{pSection}</span>
                            )}
                            {pDiff && (
                              <DifficultyBadge difficulty={pDiff as 'Easy' | 'Medium' | 'Hard'} />
                            )}
                          </div>
                        </div>
                      </td>

                      <td>
                        <RecallResultBadge result={rev.recallResult} />
                      </td>

                      <td>
                        {rev.coldSolve === true ? (
                          <span className={styles.coldBadgeYes} title="Solved cold without hints or looking at notes">
                            Cold Solve ✓
                          </span>
                        ) : rev.coldSolve === false ? (
                          <span className={styles.coldBadgeNo}>
                            Guided
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-dim)' }}>—</span>
                        )}
                      </td>

                      <td className={styles.stageCell}>
                        {hasPrevious && hasNew ? (
                          <div className={styles.stageTransition}>
                            <span>Stage {rev.previousStage}</span>
                            <ArrowRight size={12} color="var(--accent-cyan)" />
                            <span style={{ color: 'var(--accent-cyan)', fontWeight: 700 }}>
                              Stage {rev.newStage} ({rev.newIntervalDays}d)
                            </span>
                          </div>
                        ) : hasNew ? (
                          <span style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>
                            Stage {rev.newStage} ({rev.newIntervalDays}d)
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>

                      <td>
                        <span
                          className={`${styles.timingBadge} ${rev.timingStatus === 'LATE'
                            ? styles.timingLate
                            : rev.timingStatus === 'EARLY'
                              ? styles.timingEarly
                              : styles.timingOnTime
                            }`}
                        >
                          {formatLatenessText(rev.timingStatus, rev.latenessDays)}
                        </span>
                      </td>

                      <td className={styles.dateCell}>
                        <div className={styles.dateGroup}>
                          <span className={styles.calendarDay}>
                            {formatCalendarDate(rev.reviewedAt)}
                          </span>
                          <span className={styles.timeHour}>
                            {new Date(rev.reviewedAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      </td>

                      <td className={styles.durationCell}>
                        {formatDuration(rev.timeSpentSeconds)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {pagination.totalPages > 1 && (
            <div className={styles.paginationBar}>
              <span className={styles.pageInfo}>
                Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
              </span>
              <div className={styles.paginationBtns}>
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  className={styles.pageBtn}
                >
                  <ChevronLeft size={16} />
                  <span>Previous</span>
                </button>
                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages}
                  className={styles.pageBtn}
                >
                  <span>Next</span>
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
