import React from 'react';
import { History, Clock, ArrowRight, Zap } from 'lucide-react';
import { RevisionHistoryItem } from '../../types';
import { RecallResultBadge } from './RecallResultBadge';
import { Badge, BadgeTone } from '../ui/Badge';
import { Card } from '../ui/Card';
import { EmptyState } from '../ui/EmptyState';
import { Skeleton } from '../ui/Skeleton';
import { formatTiming, formatCalendarDate } from '../../utils/date.utils';
import styles from './RevisionHistoryList.module.css';

interface RevisionHistoryListProps {
  history: RevisionHistoryItem[];
  isLoading?: boolean;
}

/**
 * DSA Tracker — Revision history list (Phase 8)
 * =============================================
 * The per-problem revision log, restyled onto the design tokens and Phase 2 primitives.
 *
 * The data shown is exactly the data shown before — reviewed-at date, recall result,
 * day-counted punctuality, minutes spent, stage/interval transition, retention
 * transition and the cold-solve flag. Nothing is recomputed here: the timing label is
 * still `formatTiming` (calendar days, never hours) and the dates are still
 * `formatCalendarDate` (UTC calendar day).
 *
 * What the restyle changes:
 *   - the loading state is a `role="status"` skeleton that matches the real rows, so the
 *     section does not jump from one line of text to a full timeline;
 *   - the empty state is the shared `EmptyState` (`compact`) with a real heading;
 *   - each entry is a `<li>` in an ordered list, so assistive technology announces
 *     "list, N items" and the chronological order is structural rather than visual;
 *   - tone is never colour-only: punctuality and recall both carry their word, and the
 *     time-spent row carries a screen-reader label.
 */

const timingTone = (status: RevisionHistoryItem['timingStatus']): BadgeTone => {
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

export const RevisionHistoryList: React.FC<RevisionHistoryListProps> = ({
  history,
  isLoading = false,
}) => {
  if (isLoading) {
    return (
      <div className={styles.loading} role="status" aria-busy="true">
        <span className="sr-only">Loading revision history</span>
        {[0, 1].map((index) => (
          <div key={index} className={styles.skeletonCard} aria-hidden="true">
            <div className={styles.skeletonRow}>
              <Skeleton width={96} height={20} />
              <Skeleton width={72} height={20} />
              <Skeleton width={84} height={20} />
            </div>
            <Skeleton width="70%" height={14} />
          </div>
        ))}
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <EmptyState
        variant="compact"
        titleAs="h4"
        icon={<History size={22} />}
        title="No revisions recorded for this problem yet."
        description="When due, review attempts and their scheduling transitions will be preserved here."
      />
    );
  }

  return (
    <ol className={styles.timeline}>
      {history.map((item) => (
        <li key={item.id}>
          <Card variant="compact" className={styles.card}>
            <div className={styles.topRow}>
              <div className={styles.metaGroup}>
                <span className={styles.dateText}>{formatCalendarDate(item.reviewedAt)}</span>
                <RecallResultBadge result={item.recallResult} />
                <Badge tone={timingTone(item.timingStatus)} shape="compact" dot>
                  {formatTiming(item.timingStatus, item.latenessDays)}
                </Badge>
              </div>

              {item.timeSpentSeconds !== null &&
                item.timeSpentSeconds !== undefined &&
                item.timeSpentSeconds > 0 && (
                  <span className={styles.timeSpent}>
                    <Clock size={12} aria-hidden="true" />
                    <span className="sr-only">Time spent:</span>
                    <span aria-hidden="true">{Math.round(item.timeSpentSeconds / 60)} min</span>
                  </span>
                )}
            </div>

            <div className={styles.detailsRow}>
              <span className={styles.transition}>
                <Zap size={13} className={styles.transitionIcon} aria-hidden="true" />
                <span className="sr-only">Stage transition:</span>
                <span className={styles.transitionText}>
                  Stage {item.previousStage} ({item.previousIntervalDays}d)
                </span>
                <ArrowRight size={12} aria-hidden="true" />
                <span className={styles.transitionText}>
                  Stage {item.newStage} ({item.newIntervalDays}d)
                </span>
              </span>

              <span className={styles.retention}>
                <span className={styles.retentionLabel}>Retention:</span>
                <span className={styles.retentionValue}>
                  {item.previousRetention} → {item.newRetention}
                </span>
              </span>

              {item.coldSolve && (
                <Badge tone="info" shape="compact">
                  Cold Solve
                </Badge>
              )}
            </div>
          </Card>
        </li>
      ))}
    </ol>
  );
};
