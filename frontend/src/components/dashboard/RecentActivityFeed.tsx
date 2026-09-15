import React from 'react';
import { Link } from 'react-router-dom';
import { History, Zap, Bookmark, Clock } from 'lucide-react';
import { DashboardData, RecallResultType } from '../../types';
import styles from './RecentActivityFeed.module.css';

interface RecentActivityFeedProps {
  recentActivity: DashboardData['recentActivity'];
}

export const RecentActivityFeed: React.FC<RecentActivityFeedProps> = ({
  recentActivity,
}) => {
  const getRecallBadge = (result: RecallResultType) => {
    switch (result) {
      case 'EASY':
        return <span className={`${styles.recallPill} ${styles.pillEasy}`}>EASY</span>;
      case 'STRUGGLED':
        return <span className={`${styles.recallPill} ${styles.pillStruggled}`}>STRUGGLED</span>;
      case 'HINT':
        return <span className={`${styles.recallPill} ${styles.pillHint}`}>HINT</span>;
      case 'FORGOT':
      default:
        return <span className={`${styles.recallPill} ${styles.pillForgot}`}>FORGOT</span>;
    }
  };

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
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.cardTitle}>
            <History size={16} color="var(--accent-cyan)" />
            <span>Recent Practice Activity</span>
          </div>
          <span className={styles.headerMeta}>Last {recentActivity.length} reviews</span>
        </div>

        {recentActivity.length === 0 ? (
          <div className={styles.emptyState}>
            <Clock size={28} className={styles.emptyIcon} />
            <p className={styles.emptyText}>
              No reviews logged yet. Complete reviews in your queue to populate your activity feed.
            </p>
          </div>
        ) : (
          <div className={styles.feedList}>
            {recentActivity.map((item) => (
              <div key={item.id} className={styles.feedItem}>
                <div className={styles.itemLeft}>
                  {getRecallBadge(item.recallResult)}

                  <div className={styles.problemInfo}>
                    <div className={styles.titleRow}>
                      <Link
                        to={`/problems/${item.problemId}`}
                        className={styles.problemTitle}
                      >
                        {item.problemTitle}
                      </Link>

                      {item.coldSolve && (
                        <span className={styles.coldSolveBadge}>
                          <Zap size={10} /> Cold Solve
                        </span>
                      )}
                    </div>

                    <div className={styles.metaRow}>
                      <span>{item.problemDifficulty}</span>
                      <span>·</span>
                      <span>{item.problemSection === 'COLLEGE' ? 'College' : 'Personal'}</span>
                      {item.primaryPatternName && (
                        <>
                          <span>·</span>
                          <span className={styles.patternTag}>
                            <Bookmark size={10} />
                            {item.primaryPatternName}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className={styles.itemRight}>
                  <span className={styles.dateText}>{formatDate(item.reviewedAt)}</span>
                  <span className={styles.timingBadge}>
                    {formatTiming(item.timingStatus, item.latenessDays)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
