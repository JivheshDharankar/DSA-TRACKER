import React from 'react';
import { Link } from 'react-router-dom';
import { Clock, ArrowRight } from 'lucide-react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import styles from './ReviewQueueHero.module.css';

/**
 * DSA Tracker — Today review panel (Phase 5)
 * =========================================
 * Area 2 of the dashboard, in the existing `ReviewQueueHero` file (kept in place —
 * Phase 5 restructures responsibilities rather than renaming files).
 *
 * Behaviour is unchanged: the four queue counts, the conditional description, the
 * `/review` action when something is due, and the `All Caught Up!` state when nothing
 * is. Presentation now uses `Card`/`Badge` and the design tokens — the legacy gradient,
 * blur and glow column are gone.
 */

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
  /** Tones are semantic tokens: the actionable count is accent, overdue is danger. */
  const metrics = [
    { key: 'dueNow', label: 'Due Now', value: dueNow, tone: styles.toneAccent },
    { key: 'overdue', label: 'Overdue', value: overdue, tone: styles.toneDanger },
    { key: 'dueToday', label: 'Due Today', value: dueToday, tone: styles.toneInfo },
    { key: 'upcoming', label: 'Upcoming', value: upcoming, tone: styles.toneNeutral },
  ];

  return (
    <Card className={styles.card}>
      <h2 className={styles.title}>
        <Clock size={16} aria-hidden="true" />
        Today's Revision Queue
      </h2>

      <p className={styles.desc}>
        {dueNow > 0
          ? `You have ${dueNow} ${dueNow === 1 ? 'problem' : 'problems'} due for spaced repetition review today.`
          : 'All scheduled reviews are complete for today. Your memory traces are reinforced!'}
      </p>

      <dl className={styles.metrics}>
        {metrics.map((metric) => (
          <div key={metric.key} className={styles.metric}>
            <dt className={styles.metricLabel}>{metric.label}</dt>
            <dd className={`${styles.metricValue} ${metric.tone}`}>{metric.value}</dd>
          </div>
        ))}
      </dl>

      <div className={styles.actions}>
        {dueNow > 0 ? (
          /* A real anchor keeps `/review` link semantics; `Button` renders a <button>,
             so this is styled from the same tokens instead of nesting interactive
             elements. */
          <Link to="/review" className={styles.cta}>
            <span>Start Reviewing ({dueNow} Due)</span>
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        ) : (
          <Badge tone="success" shape="pill" dot>
            All Caught Up!
          </Badge>
        )}
      </div>
    </Card>
  );
};
