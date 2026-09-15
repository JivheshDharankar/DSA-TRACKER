import React from 'react';
import { Target, BrainCircuit, Clock } from 'lucide-react';
import { DashboardData } from '../../types';
import styles from './PerformanceSummary.module.css';

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

  return (
    <div className={styles.container}>
      {/* 1. Recall Accuracy */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.cardTitle}>
            <Target size={16} color="var(--accent-cyan)" />
            <span>Recall Accuracy</span>
          </div>
          <span className={styles.headerMeta}>{totalReviews} total</span>
        </div>

        <div className={styles.barsList}>
          <div className={styles.barItem}>
            <div className={styles.barLabelRow}>
              <span className={styles.barLabel}>EASY</span>
              <span className={styles.barValue}>
                {easyPct}% ({reviewStats.easy})
              </span>
            </div>
            <div className={styles.track}>
              <div className={`${styles.fill} ${styles.fillEasy}`} style={{ width: `${easyPct}%` }} />
            </div>
          </div>

          <div className={styles.barItem}>
            <div className={styles.barLabelRow}>
              <span className={styles.barLabel}>STRUGGLED</span>
              <span className={styles.barValue}>
                {struggledPct}% ({reviewStats.struggled})
              </span>
            </div>
            <div className={styles.track}>
              <div
                className={`${styles.fill} ${styles.fillStruggled}`}
                style={{ width: `${struggledPct}%` }}
              />
            </div>
          </div>

          <div className={styles.barItem}>
            <div className={styles.barLabelRow}>
              <span className={styles.barLabel}>HINT</span>
              <span className={styles.barValue}>
                {hintPct}% ({reviewStats.hint})
              </span>
            </div>
            <div className={styles.track}>
              <div className={`${styles.fill} ${styles.fillHint}`} style={{ width: `${hintPct}%` }} />
            </div>
          </div>

          <div className={styles.barItem}>
            <div className={styles.barLabelRow}>
              <span className={styles.barLabel}>FORGOT</span>
              <span className={styles.barValue}>
                {forgotPct}% ({reviewStats.forgot})
              </span>
            </div>
            <div className={styles.track}>
              <div
                className={`${styles.fill} ${styles.fillForgot}`}
                style={{ width: `${forgotPct}%` }}
              />
            </div>
          </div>
        </div>

        <div className={styles.footerSummary}>
          <span>
            Successful (Easy + Struggled):{' '}
            <strong className={styles.highlight}>
              {reviewStats.easy + reviewStats.struggled} ({reviewStats.successRate}%)
            </strong>
          </span>
        </div>
      </div>

      {/* 2. Retention Distribution */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.cardTitle}>
            <BrainCircuit size={16} color="var(--accent-violet)" />
            <span>Retention Distribution</span>
          </div>
          <span className={styles.headerMeta}>{problemTotal} problems</span>
        </div>

        <div className={styles.barsList}>
          <div className={styles.barItem}>
            <div className={styles.barLabelRow}>
              <span className={styles.barLabel}>Strong</span>
              <span className={styles.barValue}>
                {strongPct}% ({retention.strong})
              </span>
            </div>
            <div className={styles.track}>
              <div
                className={`${styles.fill} ${styles.fillStrong}`}
                style={{ width: `${strongPct}%` }}
              />
            </div>
          </div>

          <div className={styles.barItem}>
            <div className={styles.barLabelRow}>
              <span className={styles.barLabel}>Independent</span>
              <span className={styles.barValue}>
                {independentPct}% ({retention.independent})
              </span>
            </div>
            <div className={styles.track}>
              <div
                className={`${styles.fill} ${styles.fillIndependent}`}
                style={{ width: `${independentPct}%` }}
              />
            </div>
          </div>

          <div className={styles.barItem}>
            <div className={styles.barLabelRow}>
              <span className={styles.barLabel}>Familiar</span>
              <span className={styles.barValue}>
                {familiarPct}% ({retention.familiar})
              </span>
            </div>
            <div className={styles.track}>
              <div
                className={`${styles.fill} ${styles.fillFamiliar}`}
                style={{ width: `${familiarPct}%` }}
              />
            </div>
          </div>

          <div className={styles.barItem}>
            <div className={styles.barLabelRow}>
              <span className={styles.barLabel}>Learning</span>
              <span className={styles.barValue}>
                {learningPct}% ({retention.learning})
              </span>
            </div>
            <div className={styles.track}>
              <div
                className={`${styles.fill} ${styles.fillLearning}`}
                style={{ width: `${learningPct}%` }}
              />
            </div>
          </div>
        </div>

        <div className={styles.footerSummary}>
          <span>
            Independent & Strong:{' '}
            <strong className={styles.highlight}>
              {retention.independent + retention.strong} problems
            </strong>
          </span>
        </div>
      </div>

      {/* 3. Revision Timing */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.cardTitle}>
            <Clock size={16} color="#34d399" />
            <span>Revision Timing</span>
          </div>
          <span className={styles.headerMeta}>
            Avg lateness: {timing.averageLatenessDays} {timing.averageLatenessDays === 1 ? 'day' : 'days'}
          </span>
        </div>

        <div className={styles.barsList}>
          <div className={styles.barItem}>
            <div className={styles.barLabelRow}>
              <span className={styles.barLabel}>On Time</span>
              <span className={styles.barValue}>
                {onTimePct}% ({timing.onTime})
              </span>
            </div>
            <div className={styles.track}>
              <div
                className={`${styles.fill} ${styles.fillOnTime}`}
                style={{ width: `${onTimePct}%` }}
              />
            </div>
          </div>

          <div className={styles.barItem}>
            <div className={styles.barLabelRow}>
              <span className={styles.barLabel}>Late</span>
              <span className={styles.barValue}>
                {latePct}% ({timing.late})
              </span>
            </div>
            <div className={styles.track}>
              <div className={`${styles.fill} ${styles.fillLate}`} style={{ width: `${latePct}%` }} />
            </div>
          </div>

          <div className={styles.barItem}>
            <div className={styles.barLabelRow}>
              <span className={styles.barLabel}>Early</span>
              <span className={styles.barValue}>
                {earlyPct}% ({timing.early})
              </span>
            </div>
            <div className={styles.track}>
              <div
                className={`${styles.fill} ${styles.fillEarly}`}
                style={{ width: `${earlyPct}%` }}
              />
            </div>
          </div>
        </div>

        <div className={styles.footerSummary}>
          <span>
            On-Time Discipline:{' '}
            <strong className={styles.highlight}>
              {onTimePct}% on schedule
            </strong>
          </span>
        </div>
      </div>
    </div>
  );
};
