import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { Card } from '../ui/Card';
import { Progress, ProgressTone } from '../ui/Progress';
import { DashboardData } from '../../types';
import styles from './QuickStatsGrid.module.css';

/**
 * DSA Tracker — Metric strip + progress panel (Phase 5)
 * ====================================================
 * This file keeps its original name (Phase 5 restructures the existing five dashboard
 * components in place rather than renaming files), and now hosts the two
 * responsibilities the old "quick stats" grid carried:
 *
 *   MetricStrip    — the full-width row of headline numbers (area 3)
 *   ProgressPanel  — completion toward the goal plus the College/Personal splits
 *                    (area 4)
 *
 * Splitting the five legacy stat cards into "numbers" and "progress" is what lets the
 * strip stay dense on one row while the splittable measures get bars. Every value and
 * every percentage formula is the one the old cards used — `Problem` counts, the
 * `locked`/`unlocked` nullish fallbacks, `Math.round((solved / total) * 100)` — and the
 * `/college-dsa` and `/personal-dsa` links are preserved.
 */

const percentOf = (value: number, total: number): number =>
  total > 0 ? Math.round((value / total) * 100) : 0;

interface MetricStripProps {
  problemStats: DashboardData['problemStats'];
  reviewStats: DashboardData['reviewStats'];
  streak: DashboardData['streak'];
}

/** Area 3 — headline numbers only, no bars, so six tiles fit one row at >=1280. */
export const MetricStrip: React.FC<MetricStripProps> = ({
  problemStats,
  reviewStats,
  streak,
}) => {
  const totalSolvedPct = percentOf(problemStats.solved, problemStats.total);

  const metrics: Array<{
    key: string;
    label: string;
    value: React.ReactNode;
    meta: string;
  }> = [
    {
      key: 'total',
      label: 'Total Problems',
      value: problemStats.total,
      meta: `${problemStats.solved} solved`,
    },
    {
      key: 'solved',
      label: 'Solved',
      value: problemStats.solved,
      meta: `${totalSolvedPct}% of ${problemStats.total}`,
    },
    {
      key: 'attempted',
      label: 'Attempted',
      value: problemStats.attempted,
      meta: `${problemStats.notStarted} not started`,
    },
    {
      key: 'locked',
      label: 'Locked',
      value: problemStats.locked ?? 0,
      meta: `${problemStats.unlocked ?? 0} unlocked`,
    },
    {
      key: 'reviews',
      label: 'Reviews',
      value: reviewStats.totalReviews,
      meta: `${reviewStats.successRate}% accuracy · ${reviewStats.independentColdSolves} cold solves`,
    },
    {
      key: 'streak',
      label: 'Active Streak',
      value: (
        <>
          {streak.current}
          <span className={styles.metricUnit}>days</span>
        </>
      ),
      meta: `longest ${streak.longest} days`,
    },
  ];

  return (
    <div className={styles.strip}>
      {metrics.map((metric) => (
        <Card key={metric.key} variant="compact" className={styles.metric}>
          <span className={styles.metricLabel}>{metric.label}</span>
          <span className={styles.metricValue}>{metric.value}</span>
          <span className={styles.metricMeta}>{metric.meta}</span>
        </Card>
      ))}
    </div>
  );
};

interface ProgressRowProps {
  label: string;
  summary: string;
  value: number;
  max: number;
  tone: ProgressTone;
  link?: { to: string; label: string };
}

const ProgressRow: React.FC<ProgressRowProps> = ({
  label,
  summary,
  value,
  max,
  tone,
  link,
}) => (
  <div className={styles.progressRow}>
    <div className={styles.progressRowHead}>
      <span className={styles.progressRowLabel}>{label}</span>
      {link ? (
        <Link to={link.to} className={styles.viewLink} aria-label={link.label}>
          <span>View</span>
          <ArrowUpRight size={13} aria-hidden="true" />
        </Link>
      ) : null}
    </div>

    <Progress value={value} max={max} label={`${label} solved`} tone={tone} size="sm" />
    <span className={styles.progressRowSummary}>{summary}</span>
  </div>
);

interface ProgressPanelProps {
  problemStats: DashboardData['problemStats'];
}

/** Area 4 — the same counts as the old split cards, expressed as completion. */
export const ProgressPanel: React.FC<ProgressPanelProps> = ({ problemStats }) => {
  const totalSolvedPct = percentOf(problemStats.solved, problemStats.total);
  const collegeSolvedPct = percentOf(problemStats.college.solved, problemStats.college.total);
  const personalSolvedPct = percentOf(problemStats.personal.solved, problemStats.personal.total);

  return (
    <Card className={styles.progressCard}>
      <h2 className={styles.panelTitle}>Completion &amp; Section Progress</h2>

      <ProgressRow
        label="Overall"
        summary={`${problemStats.solved} of ${problemStats.total} solved (${totalSolvedPct}%)`}
        value={problemStats.solved}
        max={problemStats.total}
        tone="accent"
      />

      <ProgressRow
        label="College DSA"
        summary={`${problemStats.college.solved} of ${problemStats.college.total} solved (${collegeSolvedPct}%)`}
        value={problemStats.college.solved}
        max={problemStats.college.total}
        tone="accent"
        link={{ to: '/college-dsa', label: 'View College DSA problems' }}
      />

      <ProgressRow
        label="Personal DSA"
        summary={`${problemStats.personal.solved} of ${problemStats.personal.total} solved (${personalSolvedPct}%)`}
        value={problemStats.personal.solved}
        max={problemStats.personal.total}
        tone="accent"
        link={{ to: '/personal-dsa', label: 'View Personal DSA problems' }}
      />
    </Card>
  );
};
