import React from 'react';
import { Link } from 'react-router-dom';
import { Award, Target, ArrowRight, Sparkles, BookOpen } from 'lucide-react';
import { Card } from '../ui/Card';
import { EmptyState } from '../ui/EmptyState';
import { DashboardData, DashboardPatternItem, PatternMasteryLevel } from '../../types';
import styles from './PatternMasterySummary.module.css';

/**
 * DSA Tracker — Pattern progress list (Phase 5)
 * ============================================
 * Area 6 of the dashboard, in the existing `PatternMasterySummary` file: the mastery
 * overview counts, the strongest patterns, and what needs practice.
 *
 * The mastery chip and its bar are a data ramp, so both read the `--color-mastery-*`
 * tokens rather than a status tone — the same four hues the analytics retention ramp
 * uses, which keeps the language consistent across the page. Every label, score,
 * problem count, aria-label and the `Math.max(4, score)` minimum bar width are
 * unchanged, as are the `/patterns` and `/patterns/:id` targets.
 */

const MASTERY_BADGE_CLASS: Record<PatternMasteryLevel, string> = {
  Strong: styles.badgeStrong,
  Independent: styles.badgeIndependent,
  Familiar: styles.badgeFamiliar,
  Learning: styles.badgeLearning,
};

const MASTERY_FILL_CLASS: Record<PatternMasteryLevel, string> = {
  Strong: styles.fillStrong,
  Independent: styles.fillIndependent,
  Familiar: styles.fillFamiliar,
  Learning: styles.fillLearning,
};

interface PatternRowProps {
  pattern: DashboardPatternItem;
  /** Prefix for the accessible name, e.g. "View pattern". */
  actionLabel: string;
}

const PatternRow: React.FC<PatternRowProps> = ({ pattern, actionLabel }) => (
  <Link
    to={`/patterns/${pattern.id}`}
    className={styles.patternItem}
    aria-label={`${actionLabel} ${pattern.name}, mastery score ${pattern.score}`}
  >
    <div className={styles.patternTop}>
      <span className={styles.patternName}>{pattern.name}</span>
      <span className={styles.patternMeta}>
        <span className={`${styles.badge} ${MASTERY_BADGE_CLASS[pattern.masteryLevel]}`}>
          {pattern.masteryLevel}
        </span>
        <span className={styles.scoreText}>{pattern.score}%</span>
      </span>
    </div>

    <div className={styles.patternBottom}>
      <span className={styles.track}>
        <span
          className={`${styles.fill} ${MASTERY_FILL_CLASS[pattern.masteryLevel]}`}
          style={{ width: `${Math.max(4, pattern.score)}%` }}
        />
      </span>
      <span className={styles.problemCount}>
        {pattern.problemCount} {pattern.problemCount === 1 ? 'problem' : 'problems'}
      </span>
    </div>
  </Link>
);

interface PatternMasterySummaryProps {
  patternSummary: DashboardData['patternSummary'];
}

export const PatternMasterySummary: React.FC<PatternMasterySummaryProps> = ({
  patternSummary,
}) => {
  const overview = [
    { key: 'strong', label: 'Strong', value: patternSummary.strong, className: styles.statStrong },
    {
      key: 'independent',
      label: 'Independent',
      value: patternSummary.independent,
      className: styles.statIndependent,
    },
    {
      key: 'familiar',
      label: 'Familiar',
      value: patternSummary.familiar,
      className: styles.statFamiliar,
    },
    {
      key: 'learning',
      label: 'Learning',
      value: patternSummary.learning,
      className: styles.statLearning,
    },
  ];

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Pattern Mastery</h2>

      <div className={styles.cards}>
        {/* 1. Strongest Patterns */}
        <Card className={styles.card}>
          <div className={styles.cardHeader}>
            <h3 className={styles.cardTitle}>
              <Award size={16} aria-hidden="true" />
              Strongest Patterns
            </h3>
            <Link to="/patterns" className={styles.viewLink}>
              <span>View Library</span>
              <ArrowRight size={13} aria-hidden="true" />
            </Link>
          </div>

          <div className={styles.overviewBar}>
            {overview.map((stat) => (
              <div key={stat.key} className={styles.overviewStat}>
                <span className={styles.overviewStatLabel}>{stat.label}</span>
                <span className={`${styles.overviewStatValue} ${stat.className}`}>
                  {stat.value}
                </span>
              </div>
            ))}
          </div>

          <div className={styles.patternList}>
            {patternSummary.strongestPatterns.length > 0 ? (
              patternSummary.strongestPatterns.map((pattern) => (
                <PatternRow key={pattern.id} pattern={pattern} actionLabel="View pattern" />
              ))
            ) : (
              <EmptyState
                variant="compact"
                titleAs="h4"
                icon={<Sparkles size={20} />}
                title="Solve problems attached to patterns to build mastery"
              />
            )}
          </div>
        </Card>

        {/* 2. Needs Practice */}
        <Card className={styles.card}>
          <div className={styles.cardHeader}>
            <h3 className={styles.cardTitle}>
              <Target size={16} aria-hidden="true" />
              Needs Practice
            </h3>
            <Link to="/patterns" className={styles.viewLink}>
              <span>All Patterns</span>
              <ArrowRight size={13} aria-hidden="true" />
            </Link>
          </div>

          <div className={styles.patternList}>
            {patternSummary.needsPracticePatterns.length > 0 ? (
              patternSummary.needsPracticePatterns.map((pattern) => (
                <PatternRow key={pattern.id} pattern={pattern} actionLabel="Practice pattern" />
              ))
            ) : (
              <EmptyState
                variant="compact"
                titleAs="h4"
                icon={<BookOpen size={20} />}
                title="All patterns have reached strong mastery!"
              />
            )}
          </div>
        </Card>
      </div>
    </section>
  );
};
