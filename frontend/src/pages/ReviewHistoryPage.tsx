import React, { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { History, ArrowRight, ArrowUpRight, Clock, Repeat, Zap } from 'lucide-react';
import { fetchUserReviewHistory } from '../api/reviews.api';
import {
  RevisionHistoryItem,
  PaginationMeta,
  DifficultyType,
  SectionType,
  TimingStatusType,
} from '../types';
import { RecallResultBadge } from '../components/reviews/RecallResultBadge';
import { DifficultyBadge } from '../components/problems/DifficultyBadge';
import { Pagination } from '../components/problems/Pagination';
import { Card } from '../components/ui/Card';
import { Badge, BadgeTone } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { Skeleton } from '../components/ui/Skeleton';
import { formatCalendarDate, formatTiming } from '../utils/date.utils';
import styles from './ReviewHistoryPage.module.css';

/**
 * DSA Tracker — Review History (Phase 10)
 * =======================================
 * The user-wide, newest-first log of spaced-repetition attempts, restyled onto the
 * Phase 2 primitives and `styles/tokens.css`.
 *
 * What the entry shows is exactly what the API returns — no derived scores or invented
 * metrics: the reviewed-at instant (UTC calendar day + local time), the problem it
 * belongs to, the recall outcome, calendar-day punctuality, the cold-solve flag, the
 * stage/interval transition, the retention transition, the scheduled date it was
 * measured against, and the recorded time spent.
 *
 * Data flow is unchanged: page 1 loads on mount through `fetchUserReviewHistory`, the
 * pagination meta comes straight from the response, page changes refetch with the same
 * 20-row limit, and entries whose problem was deleted are still skipped rather than
 * rendered as dead links.
 *
 * The layout is a card per event rather than a table: at 768px and up the date sits in
 * its own column with the problem and outcome beside it; below that everything stacks.
 * There is no horizontal scrolling at any width.
 */

type TimingTone = BadgeTone;

const timingTone = (status: TimingStatusType): TimingTone => {
  switch (status) {
    case 'LATE':
      return 'danger';
    case 'EARLY':
      return 'info';
    case 'ON_TIME':
      return 'success';
    default:
      return 'neutral';
  }
};

interface ResolvedProblem {
  id: string;
  title: string;
  sNo?: number;
  section?: SectionType;
  difficulty?: DifficultyType;
  topic?: string;
}

/**
 * The API populates `problem` / `problemId` with the problem document. Older rows may
 * only carry the populated `problemId`, so both shapes are accepted and anything
 * without an id and title is treated as an orphaned entry.
 */
const resolveProblem = (review: RevisionHistoryItem): ResolvedProblem | null => {
  const candidate =
    review.problem ??
    (review as unknown as { problemId?: unknown }).problemId ??
    null;

  if (!candidate || typeof candidate !== 'object') {
    return null;
  }

  const raw = candidate as Record<string, unknown>;
  const id = (raw.id ?? raw._id ?? '').toString();
  const title = typeof raw.title === 'string' ? raw.title.trim() : '';

  if (!id || !title) {
    return null;
  }

  return {
    id,
    title,
    sNo: typeof raw.sNo === 'number' ? raw.sNo : undefined,
    section: typeof raw.section === 'string' ? (raw.section as SectionType) : undefined,
    difficulty: typeof raw.difficulty === 'string' ? (raw.difficulty as DifficultyType) : undefined,
    topic: typeof raw.topic === 'string' && raw.topic.trim() ? raw.topic : undefined,
  };
};

const formatClockTime = (iso: string): string => {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
};

const formatDuration = (seconds?: number | null): string => {
  if (!seconds || seconds <= 0) return '—';
  const totalMinutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;

  if (totalMinutes >= 60) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  if (totalMinutes === 0) return `${remainder}s`;
  return `${totalMinutes}m ${remainder}s`;
};

const PAGE_SIZE = 20;

export const ReviewHistoryPage: React.FC = () => {
  const navigate = useNavigate();

  const [items, setItems] = useState<RevisionHistoryItem[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    totalPages: 1,
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(async (pageToLoad: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchUserReviewHistory(pageToLoad, PAGE_SIZE);
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
    if (newPage >= 1 && newPage <= pagination.totalPages && newPage !== pagination.page) {
      loadHistory(newPage);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const visibleItems = items
    .map((review) => ({ review, problem: resolveProblem(review) }))
    .filter(
      (entry): entry is { review: RevisionHistoryItem; problem: ResolvedProblem } =>
        entry.problem !== null
    );

  const hasReviews = pagination.total > 0;
  const rangeStart = hasReviews ? (pagination.page - 1) * pagination.limit + 1 : 0;
  const rangeEnd = hasReviews ? Math.min(pagination.page * pagination.limit, pagination.total) : 0;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.heading}>
          <span className={styles.iconTile} aria-hidden="true">
            <History size={20} />
          </span>
          <div className={styles.headingText}>
            <h2 className={styles.title}>Review History</h2>
            <p className={styles.subtitle}>
              Every spaced-repetition attempt, its recall outcome, and how it moved the schedule.
            </p>
          </div>
        </div>

        <div className={styles.headerActions}>
          {!isLoading && !error ? (
            <Badge tone="neutral" shape="pill">
              {pagination.total} {pagination.total === 1 ? 'review' : 'reviews'}
            </Badge>
          ) : null}
          <Button
            variant="secondary"
            size="sm"
            iconLeft={<Repeat size={14} />}
            onClick={() => navigate('/review')}
          >
            Review Queue
          </Button>
        </div>
      </header>

      {error ? (
        <ErrorState
          variant="section"
          title="Couldn't load review history"
          message={error}
          onRetry={() => loadHistory(pagination.page)}
          isRetrying={isLoading}
        />
      ) : isLoading ? (
        <div className={styles.loading} role="status" aria-busy="true">
          <span className="sr-only">Loading review history</span>
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className={styles.skeletonCard} aria-hidden="true">
              <div className={styles.skeletonRow}>
                <Skeleton width={120} height={16} />
                <Skeleton width={180} height={16} />
                <Skeleton width={92} height={20} />
              </div>
              <Skeleton width="65%" height={12} />
            </div>
          ))}
        </div>
      ) : visibleItems.length === 0 ? (
        <EmptyState
          variant="full"
          icon={<History size={24} />}
          title={hasReviews ? 'No reviews on this page' : 'No reviews completed yet'}
          description={
            hasReviews
              ? 'These entries reference problems that no longer exist. Use the pagination below to see other reviews.'
              : 'When you complete spaced repetition sessions from your Review Queue, the recall outcome, punctuality and stage transitions of each attempt are recorded here.'
          }
          primaryAction={
            hasReviews ? undefined : (
              <Button onClick={() => navigate('/review')} iconRight={<ArrowRight size={16} />}>
                Go to Review Queue
              </Button>
            )
          }
          secondaryAction={
            hasReviews ? (
              <Button variant="secondary" onClick={() => loadHistory(1)}>
                Back to first page
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className={styles.summary} aria-live="polite">
            <span className={styles.range}>
              Showing <strong>{rangeStart}</strong>–<strong>{rangeEnd}</strong> of{' '}
              <strong>{pagination.total}</strong> {pagination.total === 1 ? 'review' : 'reviews'}
            </span>
            <span className={styles.sortNote}>Newest first</span>
          </div>

          <ol className={styles.log}>
            {visibleItems.map(({ review, problem }) => (
              <li key={review.id}>
                <Card variant="compact" className={styles.entry}>
                  <div className={styles.main}>
                    <div className={styles.when}>
                      <span className={styles.date}>{formatCalendarDate(review.reviewedAt)}</span>
                      <span className={styles.time}>{formatClockTime(review.reviewedAt)}</span>
                    </div>

                    <div className={styles.problem}>
                      <Link to={`/problems/${problem.id}`} className={styles.problemLink}>
                        {problem.title}
                        <ArrowUpRight size={14} aria-hidden="true" />
                      </Link>

                      <div className={styles.problemMeta}>
                        {problem.sNo !== undefined ? (
                          <span className={styles.sNo}>#{problem.sNo}</span>
                        ) : null}
                        {problem.section ? (
                          <span className={styles.section}>{problem.section}</span>
                        ) : null}
                        {problem.difficulty ? (
                          <DifficultyBadge difficulty={problem.difficulty} />
                        ) : null}
                        {problem.topic ? (
                          <span className={styles.topic}>{problem.topic}</span>
                        ) : null}
                      </div>
                    </div>

                    <div className={styles.outcomes}>
                      <RecallResultBadge result={review.recallResult} />
                      <Badge tone={timingTone(review.timingStatus)} shape="compact" dot>
                        {formatTiming(review.timingStatus, review.latenessDays)}
                      </Badge>
                      {review.coldSolve === true ? (
                        <Badge tone="info" shape="compact">
                          Cold solve
                        </Badge>
                      ) : review.coldSolve === false ? (
                        <Badge tone="neutral" shape="compact">
                          Guided
                        </Badge>
                      ) : null}
                    </div>
                  </div>

                  <div className={styles.details}>
                    <span className={styles.detail}>
                      <Zap size={12} className={styles.detailIcon} aria-hidden="true" />
                      <span className="sr-only">Stage transition:</span>
                      <span className={styles.mono}>
                        Stage {review.previousStage} ({review.previousIntervalDays}d)
                      </span>
                      <ArrowRight size={12} aria-hidden="true" />
                      <span className={styles.monoStrong}>
                        Stage {review.newStage} ({review.newIntervalDays}d)
                      </span>
                    </span>

                    <span className={styles.detail}>
                      <span className={styles.detailLabel}>Retention</span>
                      <span>
                        {review.previousRetention} → {review.newRetention}
                      </span>
                    </span>

                    <span className={styles.detail}>
                      <span className={styles.detailLabel}>Scheduled</span>
                      <span>{formatCalendarDate(review.scheduledReviewAt)}</span>
                    </span>

                    <span className={`${styles.detail} ${styles.duration}`}>
                      <Clock size={12} aria-hidden="true" />
                      <span className="sr-only">Time spent:</span>
                      <span>{formatDuration(review.timeSpentSeconds)}</span>
                    </span>
                  </div>
                </Card>
              </li>
            ))}
          </ol>
        </>
      )}

      {!isLoading && !error ? (
        <Pagination
          meta={pagination}
          onPageChange={handlePageChange}
          variant="compact"
          hideForSinglePage
          label="Review history pagination"
        />
      ) : null}
    </div>
  );
};
