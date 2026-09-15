import React from 'react';
import { Link } from 'react-router-dom';
import { Award, Target, ArrowRight, Sparkles, BookOpen } from 'lucide-react';
import { DashboardData, PatternMasteryLevel } from '../../types';
import styles from './PatternMasterySummary.module.css';

interface PatternMasterySummaryProps {
  patternSummary: DashboardData['patternSummary'];
}

export const PatternMasterySummary: React.FC<PatternMasterySummaryProps> = ({
  patternSummary,
}) => {
  const getBadgeClass = (level: PatternMasteryLevel) => {
    switch (level) {
      case 'Strong':
        return styles.badgeStrong;
      case 'Independent':
        return styles.badgeIndependent;
      case 'Familiar':
        return styles.badgeFamiliar;
      case 'Learning':
      default:
        return styles.badgeLearning;
    }
  };

  const getFillClass = (level: PatternMasteryLevel) => {
    switch (level) {
      case 'Strong':
        return styles.fillStrong;
      case 'Independent':
        return styles.fillIndependent;
      case 'Familiar':
        return styles.fillFamiliar;
      case 'Learning':
      default:
        return styles.fillLearning;
    }
  };

  return (
    <div className={styles.container}>
      {/* 1. Strongest Patterns */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.cardTitle}>
            <Award size={16} color="#10b981" />
            <span>Strongest Patterns</span>
          </div>
          <Link to="/patterns" className={styles.viewAllLink}>
            <span>View Library</span>
            <ArrowRight size={13} />
          </Link>
        </div>

        {/* Overview distribution */}
        <div className={styles.overviewBar}>
          <div className={styles.overviewStat}>
            <span className={styles.overviewStatLabel}>Strong</span>
            <span className={`${styles.overviewStatValue} ${styles.statStrong}`}>
              {patternSummary.strong}
            </span>
          </div>
          <div className={styles.overviewStat}>
            <span className={styles.overviewStatLabel}>Independent</span>
            <span className={`${styles.overviewStatValue} ${styles.statIndependent}`}>
              {patternSummary.independent}
            </span>
          </div>
          <div className={styles.overviewStat}>
            <span className={styles.overviewStatLabel}>Familiar</span>
            <span className={`${styles.overviewStatValue} ${styles.statFamiliar}`}>
              {patternSummary.familiar}
            </span>
          </div>
          <div className={styles.overviewStat}>
            <span className={styles.overviewStatLabel}>Learning</span>
            <span className={`${styles.overviewStatValue} ${styles.statLearning}`}>
              {patternSummary.learning}
            </span>
          </div>
        </div>

        <div className={styles.patternList}>
          {patternSummary.strongestPatterns.length > 0 ? (
            patternSummary.strongestPatterns.map((p) => (
              <Link
                key={p.id}
                to={`/patterns/${p.id}`}
                className={styles.patternItem}
                aria-label={`View pattern ${p.name}, mastery score ${p.score}`}
              >
                <div className={styles.patternTop}>
                  <span className={styles.patternName}>{p.name}</span>
                  <div className={styles.patternBadges}>
                    <span className={`${styles.badge} ${getBadgeClass(p.masteryLevel)}`}>
                      {p.masteryLevel}
                    </span>
                    <span className={styles.scoreText}>{p.score}%</span>
                  </div>
                </div>
                <div className={styles.patternBottom}>
                  <div className={styles.track}>
                    <div
                      className={`${styles.fill} ${getFillClass(p.masteryLevel)}`}
                      style={{ width: `${Math.max(4, p.score)}%` }}
                    />
                  </div>
                  <span className={styles.problemCount}>
                    {p.problemCount} {p.problemCount === 1 ? 'problem' : 'problems'}
                  </span>
                </div>
              </Link>
            ))
          ) : (
            <div className={styles.emptyPatterns}>
              <Sparkles size={24} />
              <span>Solve problems attached to patterns to build mastery</span>
            </div>
          )}
        </div>
      </div>

      {/* 2. Needs Practice */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.cardTitle}>
            <Target size={16} color="#f59e0b" />
            <span>Needs Practice</span>
          </div>
          <Link to="/patterns" className={styles.viewAllLink}>
            <span>All Patterns</span>
            <ArrowRight size={13} />
          </Link>
        </div>

        <div className={styles.patternList}>
          {patternSummary.needsPracticePatterns.length > 0 ? (
            patternSummary.needsPracticePatterns.map((p) => (
              <Link
                key={p.id}
                to={`/patterns/${p.id}`}
                className={styles.patternItem}
                aria-label={`Practice pattern ${p.name}, mastery score ${p.score}`}
              >
                <div className={styles.patternTop}>
                  <span className={styles.patternName}>{p.name}</span>
                  <div className={styles.patternBadges}>
                    <span className={`${styles.badge} ${getBadgeClass(p.masteryLevel)}`}>
                      {p.masteryLevel}
                    </span>
                    <span className={styles.scoreText}>{p.score}%</span>
                  </div>
                </div>
                <div className={styles.patternBottom}>
                  <div className={styles.track}>
                    <div
                      className={`${styles.fill} ${getFillClass(p.masteryLevel)}`}
                      style={{ width: `${Math.max(4, p.score)}%` }}
                    />
                  </div>
                  <span className={styles.problemCount}>
                    {p.problemCount} {p.problemCount === 1 ? 'problem' : 'problems'}
                  </span>
                </div>
              </Link>
            ))
          ) : (
            <div className={styles.emptyPatterns}>
              <BookOpen size={24} />
              <span>All patterns have reached strong mastery!</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
