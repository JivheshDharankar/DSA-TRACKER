import React from 'react';
import { Target, BrainCircuit, Clock } from 'lucide-react';
import { Card } from '../ui/Card';
import { DashboardData } from '../../types';
import styles from './PerformanceSummary.module.css';

/**
 * DSA Tracker — Analytics panel (Phase 5)
 * =======================================
 * Area 5 of the dashboard, in the existing `PerformanceSummary` file. Three cards:
 * Recall Accuracy, Retention Distribution and Revision Timing — the same cards, the
 * same numbers, the same percentage formulas and footers as before.
 *
 * A note on `Progress`: the shared primitive models one value toward a goal (used by the
 * ProgressPanel for completion). These three cards are categorical *distributions* —
 * each row needs its own meaning-carrying hue (the `--color-success` / `--color-info` /
 * `--color-danger` feedback tokens and the four-step `--color-retention-*` ramp), which
 * `Progress`'s semantic tone set deliberately does not expose. So the rows share one
 * small local bar (`DistributionRow`) built from those tokens instead of forcing
 * mismatched progress tones onto the data, and every row still exposes the exact figure
 * as text.
 */

interface DistributionRowProps {
  label: string;
  pct: number;
  count: number;
  /** Token-backed fill class for this category. */
  fill: string;
}

const DistributionRow: React.FC<DistributionRowProps> = ({ label, pct, count, fill }) => (
  <div className={styles.row}>
    <div className={styles.rowHead}>
      <span className={styles.rowLabel}>{label}</span>
      <span className={styles.rowValue}>
        {pct}% ({count})
      </span>
    </div>
    <div className={styles.track}>
      <div className={`${styles.fill} ${fill}`} style={{ width: `${pct}%` }} />
    </div>
  </div>
);

interface PerformanceSummaryProps {
  reviewStats: DashboardData['reviewStats'];
  retention: DashboardData['retention'];
  timing: DashboardData['timing'];
  problemTotal: number;
}

export const PerformanceSummary: React.FC<PerformanceSummaryProps> = ({
  reviewStats,
  retention,
  timing,
  problemTotal,
}) => {
  const totalReviews = reviewStats.totalReviews;

  const easyPct = totalReviews > 0 ? Math.round((reviewStats.easy / totalReviews) * 100) : 0;
  const struggledPct =
    totalReviews > 0 ? Math.round((reviewStats.struggled / totalReviews) * 100) : 0;
  const hintPct = totalReviews > 0 ? Math.round((reviewStats.hint / totalReviews) * 100) : 0;
  const forgotPct = totalReviews > 0 ? Math.round((reviewStats.forgot / totalReviews) * 100) : 0;

  const totalTiming = timing.onTime + timing.late + timing.early;
  const onTimePct = totalTiming > 0 ? Math.round((timing.onTime / totalTiming) * 100) : 0;
  const latePct = totalTiming > 0 ? Math.round((timing.late / totalTiming) * 100) : 0;
  const earlyPct = totalTiming > 0 ? Math.round((timing.early / totalTiming) * 100) : 0;

  const learningPct =
    problemTotal > 0 ? Math.round((retention.learning / problemTotal) * 100) : 0;
  const familiarPct =
    problemTotal > 0 ? Math.round((retention.familiar / problemTotal) * 100) : 0;
  const independentPct =
    problemTotal > 0 ? Math.round((retention.independent / problemTotal) * 100) : 0;
  const strongPct = problemTotal > 0 ? Math.round((retention.strong / problemTotal) * 100) : 0;

  const recallRows = [
    { key: 'easy', label: 'EASY', pct: easyPct, count: reviewStats.easy, fill: styles.fillEasy },
    {
      key: 'struggled',
      label: 'STRUGGLED',
      pct: struggledPct,
      count: reviewStats.struggled,
      fill: styles.fillStruggled,
    },
    { key: 'hint', label: 'HINT', pct: hintPct, count: reviewStats.hint, fill: styles.fillHint },
    {
      key: 'forgot',
      label: 'FORGOT',
      pct: forgotPct,
      count: reviewStats.forgot,
      fill: styles.fillForgot,
    },
  ];

  const retentionRows = [
    {
      key: 'strong',
      label: 'Strong',
      pct: strongPct,
      count: retention.strong,
      fill: styles.fillStrong,
    },
    {
      key: 'independent',
      label: 'Independent',
      pct: independentPct,
      count: retention.independent,
      fill: styles.fillIndependent,
    },
    {
      key: 'familiar',
      label: 'Familiar',
      pct: familiarPct,
      count: retention.familiar,
      fill: styles.fillFamiliar,
    },
    {
      key: 'learning',
      label: 'Learning',
      pct: learningPct,
      count: retention.learning,
      fill: styles.fillLearning,
    },
  ];

  const timingRows = [
    {
      key: 'onTime',
      label: 'On Time',
      pct: onTimePct,
      count: timing.onTime,
      fill: styles.fillOnTime,
    },
    { key: 'late', label: 'Late', pct: latePct, count: timing.late, fill: styles.fillLate },
    { key: 'early', label: 'Early', pct: earlyPct, count: timing.early, fill: styles.fillEarly },
  ];

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Review Analytics</h2>

      <div className={styles.cards}>
        {/* 1. Recall Accuracy */}
        <Card className={styles.card}>
          <div className={styles.cardHeader}>
            <h3 className={styles.cardTitle}>
              <Target size={16} aria-hidden="true" />
              Recall Accuracy
            </h3>
            <span className={styles.headerMeta}>{totalReviews} total</span>
          </div>

          <div className={styles.rows}>
            {recallRows.map((row) => (
              <DistributionRow
                key={row.key}
                label={row.label}
                pct={row.pct}
                count={row.count}
                fill={row.fill}
              />
            ))}
          </div>

          <p className={styles.cardFooter}>
            Successful (Easy + Struggled):{' '}
            <strong className={styles.highlight}>
              {reviewStats.easy + reviewStats.struggled} ({reviewStats.successRate}%)
            </strong>
          </p>
        </Card>

        {/* 2. Retention Distribution */}
        <Card className={styles.card}>
          <div className={styles.cardHeader}>
            <h3 className={styles.cardTitle}>
              <BrainCircuit size={16} aria-hidden="true" />
              Retention Distribution
            </h3>
            <span className={styles.headerMeta}>{problemTotal} problems</span>
          </div>

          <div className={styles.rows}>
            {retentionRows.map((row) => (
              <DistributionRow
                key={row.key}
                label={row.label}
                pct={row.pct}
                count={row.count}
                fill={row.fill}
              />
            ))}
          </div>

          <p className={styles.cardFooter}>
            Independent &amp; Strong:{' '}
            <strong className={styles.highlight}>
              {retention.independent + retention.strong} problems
            </strong>
          </p>
        </Card>

        {/* 3. Revision Timing */}
        <Card className={styles.card}>
          <div className={styles.cardHeader}>
            <h3 className={styles.cardTitle}>
              <Clock size={16} aria-hidden="true" />
              Revision Timing
            </h3>
            <span className={styles.headerMeta}>
              Avg lateness: {timing.averageLatenessDays}{' '}
              {timing.averageLatenessDays === 1 ? 'day' : 'days'}
            </span>
          </div>

          <div className={styles.rows}>
            {timingRows.map((row) => (
              <DistributionRow
                key={row.key}
                label={row.label}
                pct={row.pct}
                count={row.count}
                fill={row.fill}
              />
            ))}
          </div>

          <p className={styles.cardFooter}>
            On-Time Discipline:{' '}
            <strong className={styles.highlight}>{onTimePct}% on schedule</strong>
          </p>
        </Card>
      </div>
    </section>
  );
};
