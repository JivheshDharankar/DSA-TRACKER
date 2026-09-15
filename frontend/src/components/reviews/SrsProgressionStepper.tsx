import React from 'react';
import {
  CheckCircle2,
  ArrowRight,
  Circle,
  Repeat,
} from 'lucide-react';
import { RevisionHistoryItem } from '../../types';
import { formatCalendarDate } from '../../utils/date.utils';
import { RecallResultBadge } from './RecallResultBadge';
import styles from './SrsProgressionStepper.module.css';

export interface SrsProgressionStepperProps {
  repetitionStage: number;
  intervalDays: number;
  nextReviewDate: string;
  lastReviewedAt?: string | null;
  retentionLevel?: string;
  history?: RevisionHistoryItem[];
  compact?: boolean;
}

export const SRS_STAGES = [
  { stage: 0, label: 'Day 0', interval: 0 },
  { stage: 1, label: 'Day 1', interval: 1 },
  { stage: 2, label: 'Day 3', interval: 3 },
  { stage: 3, label: 'Day 7', interval: 7 },
  { stage: 4, label: 'Day 14', interval: 14 },
  { stage: 5, label: 'Day 30', interval: 30 },
  { stage: 6, label: 'Day 60', interval: 60 },
  { stage: 7, label: 'Day 120', interval: 120 },
  { stage: 8, label: 'Day 240', interval: 240 },
  { stage: 9, label: 'Day 365', interval: 365 },
];

/**
 * Computes calendar-day lateness/due status in pure calendar-day language.
 * Never exposes hours or minutes.
 */
export const computeDueStatus = (nextReviewDateStr: string): { label: string; state: 'OVERDUE' | 'DUE_TODAY' | 'UPCOMING' } => {
  if (!nextReviewDateStr) {
    return { label: 'Upcoming', state: 'UPCOMING' };
  }

  const now = new Date();
  const next = new Date(nextReviewDateStr);

  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const nextUtc = Date.UTC(next.getUTCFullYear(), next.getUTCMonth(), next.getUTCDate());

  const msPerDay = 24 * 60 * 60 * 1000;
  const diffDays = Math.round((todayUtc - nextUtc) / msPerDay);

  if (diffDays > 0) {
    return {
      label: diffDays === 1 ? 'Overdue by 1 day' : `Overdue by ${diffDays} days`,
      state: 'OVERDUE',
    };
  } else if (diffDays === 0) {
    return {
      label: 'Due Today',
      state: 'DUE_TODAY',
    };
  } else {
    const upcomingDays = Math.abs(diffDays);
    return {
      label: upcomingDays === 1 ? 'Upcoming tomorrow' : `Upcoming in ${upcomingDays} days`,
      state: 'UPCOMING',
    };
  }
};

export const SrsProgressionStepper: React.FC<SrsProgressionStepperProps> = ({
  repetitionStage = 0,
  intervalDays = 0,
  nextReviewDate,
  lastReviewedAt,
  retentionLevel,
  history = [],
  compact = false,
}) => {
  // "Reviews completed" derived strictly from actual RevisionHistory length
  const reviewsCompleted = history.length;
  const latestReview = reviewsCompleted > 0 ? history[0] : null;
  const dueStatus = computeDueStatus(nextReviewDate);

  /**
   * Determine step state for stage item s:
   * - If reviewsCompleted === 0:
   *     Stage 0 is 'CURRENT' (→ Day 0)
   *     Stages 1..9 are 'FUTURE' (○ Day X)
   * - If reviewsCompleted >= 1:
   *     Stage 0 is 'COMPLETED' (✓ Day 0)
   *     For stages 1..9:
   *       s.stage < repetitionStage => 'COMPLETED' (✓)
   *       s.stage === repetitionStage => 'CURRENT' (→)
   *       s.stage > repetitionStage => 'FUTURE' (○)
   */
  const getStepState = (stageIndex: number): 'COMPLETED' | 'CURRENT' | 'FUTURE' => {
    if (reviewsCompleted === 0) {
      return stageIndex === 0 ? 'CURRENT' : 'FUTURE';
    }

    if (stageIndex === 0) {
      return 'COMPLETED';
    }

    if (stageIndex < repetitionStage) {
      return 'COMPLETED';
    } else if (stageIndex === repetitionStage) {
      return 'CURRENT';
    } else {
      return 'FUTURE';
    }
  };

  return (
    <div className={`${styles.container} ${compact ? styles.containerCompact : ''}`}>
      {/* Visual Progression Stepper Line */}
      <div className={styles.stepperWrapper}>
        <div className={styles.stepperTrack}>
          {SRS_STAGES.map((item, idx) => {
            const state = getStepState(item.stage);
            return (
              <React.Fragment key={item.stage}>
                <div
                  className={`${styles.stepNode} ${
                    state === 'COMPLETED'
                      ? styles.stepCompleted
                      : state === 'CURRENT'
                      ? styles.stepCurrent
                      : styles.stepFuture
                  }`}
                  title={`${item.label} (${item.interval} days interval) — ${
                    state === 'COMPLETED' ? 'Completed' : state === 'CURRENT' ? 'Current Stage' : 'Future Stage'
                  }`}
                >
                  <div className={styles.nodeIcon}>
                    {state === 'COMPLETED' ? (
                      <CheckCircle2 size={13} />
                    ) : state === 'CURRENT' ? (
                      <ArrowRight size={13} />
                    ) : (
                      <Circle size={10} />
                    )}
                  </div>
                  <span className={styles.nodeLabel}>{item.label}</span>
                </div>

                {idx < SRS_STAGES.length - 1 && (
                  <div
                    className={`${styles.stepConnector} ${
                      state === 'COMPLETED' ? styles.connectorActive : ''
                    }`}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Spaced Repetition Metrics Grid */}
      {!compact && (
        <div className={styles.metricsBox}>
          <div className={styles.metricsHeader}>
            <div className={styles.metricsTitleGroup}>
              <Repeat size={15} color="var(--accent-cyan)" />
              <span className={styles.metricsTitle}>Spaced Repetition Progression</span>
            </div>
            <span
              className={`${styles.statusBadge} ${
                dueStatus.state === 'OVERDUE'
                  ? styles.statusOverdue
                  : dueStatus.state === 'DUE_TODAY'
                  ? styles.statusDueToday
                  : styles.statusUpcoming
              }`}
            >
              {dueStatus.label}
            </span>
          </div>

          <div className={styles.metricsGrid}>
            <div className={styles.metricItem}>
              <span className={styles.metricLabel}>Reviews completed</span>
              <span className={styles.metricValue}>{reviewsCompleted}</span>
            </div>

            <div className={styles.metricItem}>
              <span className={styles.metricLabel}>Current stage</span>
              <span className={styles.metricValue} style={{ color: 'var(--accent-cyan)' }}>
                Stage {repetitionStage} (Day {intervalDays})
              </span>
            </div>

            <div className={styles.metricItem}>
              <span className={styles.metricLabel}>Current interval</span>
              <span className={styles.metricValue}>
                {intervalDays} {intervalDays === 1 ? 'day' : 'days'}
              </span>
            </div>

            <div className={styles.metricItem}>
              <span className={styles.metricLabel}>Last reviewed</span>
              <span className={styles.metricValue}>
                {lastReviewedAt ? formatCalendarDate(lastReviewedAt) : 'Never reviewed'}
              </span>
            </div>

            <div className={styles.metricItem}>
              <span className={styles.metricLabel}>Next review</span>
              <span className={styles.metricValue} style={{ color: 'var(--color-easy)' }}>
                {nextReviewDate ? formatCalendarDate(nextReviewDate) : 'Not scheduled'}
              </span>
            </div>

            <div className={styles.metricItem}>
              <span className={styles.metricLabel}>Latest recall</span>
              <div className={styles.metricValue}>
                {latestReview ? (
                  <RecallResultBadge result={latestReview.recallResult} />
                ) : (
                  <span style={{ color: 'var(--text-dim)' }}>—</span>
                )}
              </div>
            </div>

            <div className={styles.metricItem}>
              <span className={styles.metricLabel}>Cold Solve</span>
              <span className={styles.metricValue}>
                {latestReview && latestReview.coldSolve !== null && latestReview.coldSolve !== undefined ? (
                  latestReview.coldSolve ? (
                    <span style={{ color: 'var(--color-easy)', fontWeight: 600 }}>Yes ✓</span>
                  ) : (
                    <span style={{ color: 'var(--text-muted)' }}>No</span>
                  )
                ) : (
                  <span style={{ color: 'var(--text-dim)' }}>—</span>
                )}
              </span>
            </div>

            {retentionLevel && (
              <div className={styles.metricItem}>
                <span className={styles.metricLabel}>Retention Level</span>
                <span className={styles.metricValue} style={{ color: 'var(--accent-violet)' }}>
                  {retentionLevel}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
