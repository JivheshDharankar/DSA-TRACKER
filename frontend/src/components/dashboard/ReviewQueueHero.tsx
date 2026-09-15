import React from 'react';
import { Link } from 'react-router-dom';
import { Clock, ArrowRight, CheckCircle2 } from 'lucide-react';
import styles from './ReviewQueueHero.module.css';

interface ReviewQueueHeroProps {
  dueNow: number;
  overdue: number;
  dueToday: number;
  upcoming: number;
}

export const ReviewQueueHero: React.FC<ReviewQueueHeroProps> = ({
  dueNow,
  overdue,
  dueToday,
  upcoming,
}) => {
  return (
    <div className={styles.card}>
      <div className={styles.leftArea}>
        <div className={styles.headingRow}>
          <Clock size={20} color="var(--accent-cyan)" />
          <h2 className={styles.title}>Today's Revision Queue</h2>
        </div>
        <p className={styles.desc}>
          {dueNow > 0
            ? `You have ${dueNow} ${dueNow === 1 ? 'problem' : 'problems'} due for spaced repetition review today.`
            : 'All scheduled reviews are complete for today. Your memory traces are reinforced!'}
        </p>

        <div className={styles.metricsRow}>
          <div className={styles.metricBox}>
            <span className={`${styles.metricVal} ${styles.dueNowVal}`}>{dueNow}</span>
            <span className={styles.metricLabel}>Due Now</span>
          </div>

          <div className={styles.metricBox}>
            <span className={`${styles.metricVal} ${styles.overdueVal}`}>{overdue}</span>
            <span className={styles.metricLabel}>Overdue</span>
          </div>

          <div className={styles.metricBox}>
            <span className={`${styles.metricVal} ${styles.dueTodayVal}`}>{dueToday}</span>
            <span className={styles.metricLabel}>Due Today</span>
          </div>

          <div className={styles.metricBox}>
            <span className={styles.metricVal}>{upcoming}</span>
            <span className={styles.metricLabel}>Upcoming</span>
          </div>
        </div>
      </div>

      <div className={styles.rightArea}>
        {dueNow > 0 ? (
          <Link to="/review" className={styles.startBtn}>
            <span>Start Reviewing ({dueNow} Due)</span>
            <ArrowRight size={18} />
          </Link>
        ) : (
          <div className={styles.clearBadge}>
            <CheckCircle2 size={18} color="#34d399" />
            <span>All Caught Up!</span>
          </div>
        )}
      </div>
    </div>
  );
};
