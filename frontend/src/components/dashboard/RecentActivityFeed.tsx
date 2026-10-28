import React from 'react';
import { Link } from 'react-router-dom';
import { History, Zap, Bookmark, Clock } from 'lucide-react';
import { Card } from '../ui/Card';
import { Badge, BadgeTone } from '../ui/Badge';
import { EmptyState } from '../ui/EmptyState';
import { DashboardData, RecallResultType } from '../../types';
import styles from './RecentActivityFeed.module.css';

/**
 * DSA Tracker — Activity timeline (Phase 5)
 * ========================================
 * Area 7 of the dashboard, in the existing `RecentActivityFeed` file. It renders the
 * same ten most recent reviews with the unchanged UTC-aware `formatDate` and
 * `formatTiming` helpers.
 *
 * Each item reads top-to-bottom (outcome + problem, then the problem metadata, then the
 * date and timing) so the rail stays readable in the narrow third column at >=1280 and
 * in a single column on phones. The recall outcome and cold-solve chips are the shared
 * `Badge` primitive, and the empty case is the shared `EmptyState`.
 */

/** Recall outcomes are a status scale, so they map onto Badge tones directly. */
const RECALL_TONE: Record<RecallResultType, BadgeTone> = {
  EASY: 'success',
  STRUGGLED: 'warning',
  HINT: 'info',
  FORGOT: 'danger',
};

interface RecentActivityFeedProps {
  recentActivity: DashboardData['recentActivity'];
}

export const RecentActivityFeed: React.FC<RecentActivityFeedProps> = ({ recentActivity }) => {
  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();

      // Compare calendar dates
      const isToday =
        date.getUTCFullYear() === now.getUTCFullYear() &&
        date.getUTCMonth() === now.getUTCMonth() &&
        date.getUTCDate() === now.getUTCDate();

      if (isToday) {
        return 'Today';
      }

      const yesterday = new Date(now);
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      const isYesterday =
        date.getUTCFullYear() === yesterday.getUTCFullYear() &&
        date.getUTCMonth() === yesterday.getUTCMonth() &&
        date.getUTCDate() === yesterday.getUTCDate();

      if (isYesterday) {
        return 'Yesterday';
      }

      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getUTCFullYear() !== now.getUTCFullYear() ? 'numeric' : undefined,
        timeZone: 'UTC',
      });
    } catch {
      return dateStr;
    }
  };

  const formatTiming = (timingStatus: string, latenessDays: number) => {
    if (timingStatus === 'ON_TIME') {
      return 'On Time';
    }
    if (timingStatus === 'LATE') {
      return `Late by ${latenessDays} ${latenessDays === 1 ? 'day' : 'days'}`;
    }
    if (timingStatus === 'EARLY') {
      return `Early by ${latenessDays} ${latenessDays === 1 ? 'day' : 'days'}`;
    }
    return timingStatus;
  };

  return (
    <Card className={styles.card}>
      <div className={styles.cardHeader}>
        <h2 className={styles.cardTitle}>
          <History size={16} aria-hidden="true" />
          Recent Practice Activity
        </h2>
        <span className={styles.headerMeta}>Last {recentActivity.length} reviews</span>
      </div>

      {recentActivity.length === 0 ? (
        <EmptyState
          variant="compact"
          titleAs="h3"
          icon={<Clock size={20} />}
          title="No reviews logged yet"
          description="Complete reviews in your queue to populate your activity feed."
        />
      ) : (
        <ol className={styles.list}>
          {recentActivity.map((item) => (
            <li key={item.id} className={styles.item}>
              <div className={styles.itemTop}>
                <Badge tone={RECALL_TONE[item.recallResult]} shape="pill">
                  {item.recallResult}
                </Badge>

                <Link to={`/problems/${item.problemId}`} className={styles.problemTitle}>
                  {item.problemTitle}
                </Link>

                {item.coldSolve ? (
                  <Badge tone="accent">
                    <Zap size={10} aria-hidden="true" />
                    Cold Solve
                  </Badge>
                ) : null}
              </div>

              <div className={styles.itemMeta}>
                <span>{item.problemDifficulty}</span>
                <span aria-hidden="true">·</span>
                <span>{item.problemSection === 'COLLEGE' ? 'College' : 'Personal'}</span>
                {item.primaryPatternName ? (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className={styles.patternTag}>
                      <Bookmark size={10} aria-hidden="true" />
                      {item.primaryPatternName}
                    </span>
                  </>
                ) : null}
              </div>

              <div className={styles.itemFoot}>
                <span className={styles.dateText}>{formatDate(item.reviewedAt)}</span>
                <span className={styles.timingText}>
                  {formatTiming(item.timingStatus, item.latenessDays)}
                </span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
};
