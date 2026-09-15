import React from 'react';
import { PatternMasteryResult } from '../../types';
import { PatternMasteryBadge } from './PatternMasteryBadge';
import styles from './PatternBreakdownCard.module.css';

interface PatternBreakdownCardProps {
  mastery: PatternMasteryResult;
  patternName?: string;
}

export const PatternBreakdownCard: React.FC<PatternBreakdownCardProps> = ({
  mastery,
  patternName,
}) => {
  const { score, masteryLevel, breakdown, problemCount, solvedCount } = mastery;

  const factors = [
    {
      name: 'Coverage',
      weight: '25% Weight',
      value: breakdown.coverage,
      fillClass: styles.fillCoverage,
      desc: 'Breadth of problems solved & practiced in this pattern (capped growth).',
    },
    {
      name: 'Independent Recall',
      weight: '25% Weight',
      value: breakdown.independentRecall,
      fillClass: styles.fillIndependent,
      desc: 'Cold-solve reproduction rate without consulting external hints or solutions.',
    },
    {
      name: 'Recall Quality',
      weight: '20% Weight',
      value: breakdown.recallQuality,
      fillClass: styles.fillQuality,
      desc: 'Overall revision accuracy across all scheduled review sessions.',
    },
    {
      name: 'Recent Consistency',
      weight: '15% Weight',
      value: breakdown.recentConsistency,
      fillClass: styles.fillConsistency,
      desc: 'Weighted recency of the last 5 revisions (newest sessions carry highest weight).',
    },
    {
      name: 'Transfer Evidence',
      weight: '15% Weight',
      value: breakdown.transferEvidence,
      fillClass: styles.fillTransfer,
      desc: 'Independent application and recognition across distinct problem variants.',
    },
  ];

  return (
    <div className={styles.breakdownCard}>
      <div className={styles.header}>
        <div className={styles.headerTitle}>
          <span>{patternName ? `${patternName} Mastery` : 'Pattern Mastery Breakdown'}</span>
        </div>
        <div className={styles.headerScore}>
          <PatternMasteryBadge level={masteryLevel} score={score} size="lg" />
          <span className={styles.scoreValue}>{score}/100</span>
        </div>
      </div>

      <div className={styles.factorsGrid}>
        {factors.map((factor) => (
          <div key={factor.name} className={styles.factorItem}>
            <div className={styles.factorHeader}>
              <span className={styles.factorName}>{factor.name}</span>
              <span className={styles.factorWeight}>{factor.weight}</span>
            </div>
            <div className={styles.factorProgress}>
              <div className={styles.progressBarTrack}>
                <div
                  className={`${styles.progressBarFill} ${factor.fillClass}`}
                  style={{ width: `${Math.min(100, Math.max(0, factor.value))}%` }}
                />
              </div>
              <span className={styles.factorPercent}>{factor.value}%</span>
            </div>
            <p className={styles.factorDesc}>{factor.desc}</p>
          </div>
        ))}
      </div>

      <div className={styles.footerSummary}>
        <span>
          Problems in Pattern:{' '}
          <strong className={styles.statsHighlight}>
            {solvedCount} solved / {problemCount} total
          </strong>
        </span>
        <span>
          Thresholds: <span className={styles.statsHighlight}>Strong (85+)</span> |{' '}
          <span className={styles.statsHighlight}>Independent (65-84)</span> |{' '}
          <span className={styles.statsHighlight}>Familiar (35-64)</span> |{' '}
          <span className={styles.statsHighlight}>Learning (&lt;35)</span>
        </span>
      </div>
    </div>
  );
};
