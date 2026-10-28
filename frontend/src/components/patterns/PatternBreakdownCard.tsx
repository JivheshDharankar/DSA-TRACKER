import React from 'react';
import { PatternMasteryResult } from '../../types';
import { Card } from '../ui/Card';
import { Progress, ProgressTone } from '../ui/Progress';
import { PatternMasteryBadge } from './PatternMasteryBadge';
import styles from './PatternBreakdownCard.module.css';

/**
 * DSA Tracker — pattern mastery breakdown
 * =======================================
 * The same five weighted factors, the same weights, the same descriptions and the same
 * level thresholds as before — what changed is the presentation: the card is the shared
 * `Card` surface, each factor bar is the shared `Progress` primitive (so every bar
 * exposes `role="progressbar"` with `aria-valuenow/min/max` and an accessible name), and
 * the tone of each bar comes from semantic tokens rather than hardcoded gradients.
 *
 * No value is derived here: `score`, `masteryLevel`, `breakdown`, `problemCount` and
 * `solvedCount` are shown exactly as the API returns them.
 */

interface FactorDefinition {
  key: keyof PatternMasteryResult['breakdown'];
  name: string;
  weight: string;
  tone: ProgressTone;
  description: string;
}

const FACTORS: FactorDefinition[] = [
  {
    key: 'coverage',
    name: 'Coverage',
    weight: '25% Weight',
    tone: 'accent',
    description: 'Breadth of problems solved & practiced in this pattern (capped growth).',
  },
  {
    key: 'independentRecall',
    name: 'Independent Recall',
    weight: '25% Weight',
    tone: 'mastery',
    description:
      'Cold-solve reproduction rate without consulting external hints or solutions.',
  },
  {
    key: 'recallQuality',
    name: 'Recall Quality',
    weight: '20% Weight',
    tone: 'success',
    description: 'Overall revision accuracy across all scheduled review sessions.',
  },
  {
    key: 'recentConsistency',
    name: 'Recent Consistency',
    weight: '15% Weight',
    tone: 'warning',
    description:
      'Weighted recency of the last 5 revisions (newest sessions carry highest weight).',
  },
  {
    key: 'transferEvidence',
    name: 'Transfer Evidence',
    weight: '15% Weight',
    tone: 'info',
    description:
      'Independent application and recognition across distinct problem variants.',
  },
];

export interface PatternBreakdownCardProps {
  mastery: PatternMasteryResult;
  patternName?: string;
}

export const PatternBreakdownCard: React.FC<PatternBreakdownCardProps> = ({
  mastery,
  patternName,
}) => {
  const { score, masteryLevel, breakdown, problemCount, solvedCount } = mastery;
  const headingId = 'pattern-mastery-breakdown-heading';

  return (
    <Card variant="raised" className={styles.card} aria-labelledby={headingId}>
      <div className={styles.header}>
        <div className={styles.headerTitle}>
          <h2 id={headingId} className={styles.title}>
            {patternName ? `${patternName} Mastery` : 'Pattern Mastery Breakdown'}
          </h2>
          <p className={styles.subtitle}>
            Weighted across five signals — {solvedCount} solved of {problemCount} linked
            problems.
          </p>
        </div>

        <div className={styles.headerScore}>
          <span className={styles.scoreValue}>
            {score}
            <span className={styles.scoreMax}>/100</span>
          </span>
          <PatternMasteryBadge level={masteryLevel} score={score} size="lg" showScore={false} />
        </div>
      </div>

      <ul className={styles.factorsGrid}>
        {FACTORS.map((factor) => (
          <li key={factor.key} className={styles.factorItem}>
            <div className={styles.factorHeader}>
              <span className={styles.factorName}>{factor.name}</span>
              <span className={styles.factorMeta}>
                <span className={styles.factorWeight}>{factor.weight}</span>
                <span className={styles.factorPercent}>{breakdown[factor.key]}%</span>
              </span>
            </div>

            <Progress
              value={breakdown[factor.key]}
              max={100}
              tone={factor.tone}
              size="sm"
              label={`${factor.name} score`}
            />

            <p className={styles.factorDesc}>{factor.description}</p>
          </li>
        ))}
      </ul>

      <div className={styles.footerSummary}>
        <span>
          Problems in Pattern:{' '}
          <strong className={styles.statsHighlight}>
            {solvedCount} solved / {problemCount} total
          </strong>
        </span>
        <span className={styles.thresholds}>
          Thresholds: <span className={styles.statsHighlight}>Strong (85+)</span> |{' '}
          <span className={styles.statsHighlight}>Independent (65-84)</span> |{' '}
          <span className={styles.statsHighlight}>Familiar (35-64)</span> |{' '}
          <span className={styles.statsHighlight}>Learning (&lt;35)</span>
        </span>
      </div>
    </Card>
  );
};
