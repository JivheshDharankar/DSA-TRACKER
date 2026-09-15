import React from 'react';
import { RevisionHistoryItem } from '../../types';
import { RecallResultBadge } from './RecallResultBadge';
import { formatTiming, formatCalendarDate } from '../../utils/date.utils';
import { History, Clock, ArrowRight, Zap } from 'lucide-react';
import styles from './RevisionHistoryList.module.css';

interface RevisionHistoryListProps {
  history: RevisionHistoryItem[];
  isLoading?: boolean;
}

export const RevisionHistoryList: React.FC<RevisionHistoryListProps> = ({
  history,
  isLoading = false,
}) => {
  if (isLoading) {
    return (
      <div className={styles.emptyState}>
        <span>Loading revision history...</span>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className={styles.emptyState}>
        <History size={20} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
        <p>No revisions recorded for this problem yet.</p>
        <p style={{ fontSize: '0.75rem', marginTop: '4px' }}>
          When due, review attempts and scheduling transitions will be preserved here.
        </p>
      </div>
    );
  }

  const getTimingTagClass = (status: string) => {
    switch (status) {
      case 'ON_TIME':
        return styles.onTime;
      case 'LATE':
        return styles.late;
      case 'EARLY':
        return styles.early;
      default:
        return styles.onTime;
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.timeline}>
        {history.map((item) => (
          <div key={item.id} className={styles.card}>
            <div className={styles.topRow}>
              <div className={styles.metaGroup}>
                <span className={styles.dateText}>{formatCalendarDate(item.reviewedAt)}</span>
                <RecallResultBadge result={item.recallResult} />
                <span className={`${styles.timingTag} ${getTimingTagClass(item.timingStatus)}`}>
                  {formatTiming(item.timingStatus, item.latenessDays)}
                </span>
              </div>

              {item.timeSpentSeconds !== null && item.timeSpentSeconds !== undefined && item.timeSpentSeconds > 0 && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '0.75rem',
                    color: 'var(--text-dim)',
                  }}
                >
                  <Clock size={12} />
                  <span>{Math.round(item.timeSpentSeconds / 60)} min</span>
                </div>
              )}
            </div>

            <div className={styles.detailsRow}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Zap size={13} color="var(--accent-cyan)" />
                <span className={styles.transitionText}>
                  Stage {item.previousStage} ({item.previousIntervalDays}d)
                </span>
                <ArrowRight size={12} />
                <span className={styles.transitionText}>
                  Stage {item.newStage} ({item.newIntervalDays}d)
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>Retention:</span>
                <span className={styles.retentionText}>
                  {item.previousRetention} → {item.newRetention}
                </span>
              </div>

              {item.coldSolve && (
                <span
                  style={{
                    fontSize: '0.7rem',
                    padding: '2px 6px',
                    background: 'rgba(56, 189, 248, 0.1)',
                    color: 'var(--accent-cyan)',
                    borderRadius: 'var(--radius-sm)',
                  }}
                >
                  Cold Solve
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
