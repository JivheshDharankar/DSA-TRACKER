import React from 'react';
import { CheckCircle2, ArrowRight, Circle, Repeat } from 'lucide-react';
import { RevisionHistoryItem } from '../../types';
import { formatCalendarDate } from '../../utils/date.utils';
import { RecallResultBadge } from './RecallResultBadge';
import { Badge, BadgeTone } from '../ui/Badge';
import { cx } from '../ui/cx';
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
 *
 * Unchanged by the redesign — `ProblemTable` and `ProblemCardList` import this function
 * directly, and the due labels it returns are part of the tracker's wording.
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

/**
 * DSA Tracker — SRS progression stepper (Phase 8)
 * ===============================================
 * The ten-stage spaced-repetition track plus, when not `compact`, the progression
 * metrics panel. Behaviour and derivation are unchanged:
 *
 *   - `reviewsCompleted` is still `history.length`, and the empty/current/completed rules
 *     for each stage are byte-for-byte the same function as before;
 *   - the due badge still comes from `computeDueStatus`, which is calendar-day based
 *     (UTC midnight), never hour based;
 *   - every metric label and value is the same one that was rendered before.
 *
 * What the redesign changes:
 *   - legacy `--text-*` / `--accent-*` / `--bg-*` names and the two raw hex values are
 *     replaced by `styles/tokens.css` values and shared `Badge` tones;
 *   - the track is an ordered list, so the stage sequence is structural. Each stage
 *     carries `aria-current="step"` when it is the learner's current stage, and its state
 *     ("Completed" / "Current stage" / "Upcoming") is real text for assistive technology
 *     rather than a `title` tooltip that only a mouse can reach;
 *   - the icon shapes still differ per state (check / arrow / circle), so state is never
 *     conveyed by colour alone;
 *   - the track no longer forces a 620px-wide horizontal scroll on phones: below 768px it
 *     reflows into a 5-column grid of stage chips (connectors hidden), and from 768px up
 *     it is the connected track.
 *
 * `compact` (used by the recall session header) renders the track only. The metrics panel
 * heading is an `<h3>`, which matches its siblings on the problem detail page.
 */
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

  const dueTone: BadgeTone =
    dueStatus.state === 'OVERDUE'
      ? 'danger'
      : dueStatus.state === 'DUE_TODAY'
        ? 'warning'
        : 'info';

  const stepStateClass = (state: 'COMPLETED' | 'CURRENT' | 'FUTURE') =>
    state === 'COMPLETED'
      ? styles.stepCompleted
      : state === 'CURRENT'
        ? styles.stepCurrent
        : styles.stepFuture;

  const stepStateLabel = (state: 'COMPLETED' | 'CURRENT' | 'FUTURE') =>
    state === 'COMPLETED' ? 'Completed' : state === 'CURRENT' ? 'Current stage' : 'Upcoming';

  return (
    <div className={cx(styles.container, compact && styles.containerCompact)}>
      {/* Visual Progression Stepper Line */}
      <div
        className={styles.stepperWrapper}
        role="group"
        aria-label="Spaced repetition stages"
      >
        <ol className={styles.stepperTrack}>
          {SRS_STAGES.map((item, idx) => {
            const state = getStepState(item.stage);
            const isLast = idx === SRS_STAGES.length - 1;

            return (
              <li
                key={item.stage}
                className={cx(styles.stepNode, stepStateClass(state))}
                aria-current={state === 'CURRENT' ? 'step' : undefined}
              >
                <span className={styles.nodeIcon} aria-hidden="true">
                  {state === 'COMPLETED' ? (
                    <CheckCircle2 size={13} />
                  ) : state === 'CURRENT' ? (
                    <ArrowRight size={13} />
                  ) : (
                    <Circle size={10} />
                  )}
                </span>

                <span className={styles.nodeLabel} aria-hidden="true">
                  {item.label}
                </span>

                <span className="sr-only">
                  {`Stage ${item.stage}: ${item.label}, ${item.interval} day interval — ${stepStateLabel(state)}`}
                </span>

                {!isLast && (
                  <span
                    className={cx(
                      styles.stepConnector,
                      state === 'COMPLETED' && styles.connectorActive
                    )}
                    aria-hidden="true"
                  />
                )}
              </li>
            );
          })}
        </ol>
      </div>

      {/* Spaced Repetition Metrics Grid */}
      {!compact && (
        <div className={styles.metricsBox}>
          <div className={styles.metricsHeader}>
            <h3 className={styles.metricsTitleGroup}>
              <Repeat size={15} className={styles.metricsIcon} aria-hidden="true" />
              <span className={styles.metricsTitle}>Spaced Repetition Progression</span>
            </h3>
            <Badge tone={dueTone} shape="pill" dot>
              {dueStatus.label}
            </Badge>
          </div>

          <dl className={styles.metricsGrid}>
            <div className={styles.metricItem}>
              <dt className={styles.metricLabel}>Reviews completed</dt>
              <dd className={styles.metricValue}>{reviewsCompleted}</dd>
            </div>

            <div className={styles.metricItem}>
              <dt className={styles.metricLabel}>Current stage</dt>
              <dd className={cx(styles.metricValue, styles.metricValueAccent)}>
                Stage {repetitionStage} (Day {intervalDays})
              </dd>
            </div>

            <div className={styles.metricItem}>
              <dt className={styles.metricLabel}>Current interval</dt>
              <dd className={styles.metricValue}>
                {intervalDays} {intervalDays === 1 ? 'day' : 'days'}
              </dd>
            </div>

            <div className={styles.metricItem}>
              <dt className={styles.metricLabel}>Last reviewed</dt>
              <dd className={styles.metricValue}>
                {lastReviewedAt ? formatCalendarDate(lastReviewedAt) : 'Never reviewed'}
              </dd>
            </div>

            <div className={styles.metricItem}>
              <dt className={styles.metricLabel}>Next review</dt>
              <dd className={cx(styles.metricValue, styles.metricValueAccent)}>
                {nextReviewDate ? formatCalendarDate(nextReviewDate) : 'Not scheduled'}
              </dd>
            </div>

            <div className={styles.metricItem}>
              <dt className={styles.metricLabel}>Latest recall</dt>
              <dd className={styles.metricValue}>
                {latestReview ? (
                  <RecallResultBadge result={latestReview.recallResult} />
                ) : (
                  <>
                    <span aria-hidden="true">—</span>
                    <span className="sr-only">No reviews recorded</span>
                  </>
                )}
              </dd>
            </div>

            <div className={styles.metricItem}>
              <dt className={styles.metricLabel}>Cold Solve</dt>
              <dd className={styles.metricValue}>
                {latestReview &&
                latestReview.coldSolve !== null &&
                latestReview.coldSolve !== undefined ? (
                  latestReview.coldSolve ? (
                    <span className={styles.metricValueYes}>Yes ✓</span>
                  ) : (
                    <span className={styles.metricValueMuted}>No</span>
                  )
                ) : (
                  <>
                    <span aria-hidden="true">—</span>
                    <span className="sr-only">No reviews recorded</span>
                  </>
                )}
              </dd>
            </div>

            {retentionLevel && (
              <div className={styles.metricItem}>
                <dt className={styles.metricLabel}>Retention Level</dt>
                <dd className={cx(styles.metricValue, styles.metricValueRetention)}>
                  {retentionLevel}
                </dd>
              </div>
            )}
          </dl>
        </div>
      )}
    </div>
  );
};
