import React from 'react';
import { Link } from 'react-router-dom';
import {
  Code2,
  GraduationCap,
  Laptop,
  Flame,
  CheckCircle2,
  ArrowUpRight,
} from 'lucide-react';
import { DashboardData } from '../../types';
import styles from './QuickStatsGrid.module.css';

interface QuickStatsGridProps {
  problemStats: DashboardData['problemStats'];
  reviewStats: DashboardData['reviewStats'];
  streak: DashboardData['streak'];
}

export const QuickStatsGrid: React.FC<QuickStatsGridProps> = ({
  problemStats,
  reviewStats,
  streak,
}) => {
  const totalSolvedPct =
    problemStats.total > 0
      ? Math.round((problemStats.solved / problemStats.total) * 100)
      : 0;

  const collegeSolvedPct =
    problemStats.college.total > 0
      ? Math.round((problemStats.college.solved / problemStats.college.total) * 100)
      : 0;

  const personalSolvedPct =
    problemStats.personal.total > 0
      ? Math.round((problemStats.personal.solved / problemStats.personal.total) * 100)
      : 0;

  return (
    <div className={styles.grid}>
      {/* 1. Total Problems */}
      <div className={styles.statCard}>
        <div>
          <div className={styles.cardTop}>
            <span className={styles.label}>Total Problems</span>
            <div className={styles.iconWrapper}>
              <Code2 size={16} color="var(--accent-cyan)" />
            </div>
          </div>
          <div className={styles.value}>{problemStats.total}</div>
          <div className={styles.subValue}>
            <strong className={styles.highlightValue}>{problemStats.solved}</strong> solved (
            {totalSolvedPct}%)
          </div>
          <div className={styles.progressTrack}>
            <div className={styles.progressFill} style={{ width: `${totalSolvedPct}%` }} />
          </div>
        </div>
        <div className={styles.footer}>
          <div className={styles.pillsRow} style={{ flexWrap: 'wrap', gap: '4px' }}>
            <span className={`${styles.pill} ${styles.pillSolved}`}>
              {problemStats.solved} Solved
            </span>
            <span className={`${styles.pill} ${styles.pillAttempted}`}>
              {problemStats.attempted} Att.
            </span>
            <span className={`${styles.pill} ${styles.pillNotStarted}`}>
              {problemStats.notStarted} New
            </span>
            <span
              className={styles.pill}
              style={{
                background: 'rgba(245, 158, 11, 0.15)',
                color: '#fbbf24',
                border: '1px solid rgba(245, 158, 11, 0.3)',
              }}
              title="Locked Mastery Count"
            >
              {problemStats.locked ?? 0} Locked
            </span>
            <span
              className={styles.pill}
              style={{
                background: 'rgba(148, 163, 184, 0.1)',
                color: '#94a3b8',
                border: '1px solid rgba(148, 163, 184, 0.2)',
              }}
              title="Unlocked Problems Count"
            >
              {problemStats.unlocked ?? 0} Unlocked
            </span>
          </div>
        </div>
      </div>

      {/* 2. College DSA Split */}
      <div className={styles.statCard}>
        <div>
          <div className={styles.cardTop}>
            <span className={styles.label}>College DSA</span>
            <div className={styles.iconWrapper}>
              <GraduationCap size={16} color="#38bdf8" />
            </div>
          </div>
          <div className={styles.value}>{problemStats.college.total}</div>
          <div className={styles.subValue}>
            <strong className={styles.highlightValue}>{problemStats.college.solved}</strong> solved (
            {collegeSolvedPct}%)
          </div>
          <div className={styles.progressTrack}>
            <div className={styles.collegeFill} style={{ width: `${collegeSolvedPct}%` }} />
          </div>
        </div>
        <div className={styles.footer}>
          <span>Assignments & Lab Curriculum</span>
          <Link to="/college-dsa" className={styles.linkBtn}>
            <span>View</span>
            <ArrowUpRight size={13} />
          </Link>
        </div>
      </div>

      {/* 3. Personal DSA Split */}
      <div className={styles.statCard}>
        <div>
          <div className={styles.cardTop}>
            <span className={styles.label}>Personal DSA</span>
            <div className={styles.iconWrapper}>
              <Laptop size={16} color="var(--accent-violet)" />
            </div>
          </div>
          <div className={styles.value}>{problemStats.personal.total}</div>
          <div className={styles.subValue}>
            <strong className={styles.highlightValue}>{problemStats.personal.solved}</strong> solved (
            {personalSolvedPct}%)
          </div>
          <div className={styles.progressTrack}>
            <div className={styles.personalFill} style={{ width: `${personalSolvedPct}%` }} />
          </div>
        </div>
        <div className={styles.footer}>
          <span>Interview Prep & LeetCode</span>
          <Link to="/personal-dsa" className={styles.linkBtn}>
            <span>View</span>
            <ArrowUpRight size={13} />
          </Link>
        </div>
      </div>

      {/* 4. Total Reviews & Cold Solves */}
      <div className={styles.statCard}>
        <div>
          <div className={styles.cardTop}>
            <span className={styles.label}>Total Reviews</span>
            <div className={styles.iconWrapper}>
              <CheckCircle2 size={16} color="#34d399" />
            </div>
          </div>
          <div className={styles.value}>{reviewStats.totalReviews}</div>
          <div className={styles.subValue}>
            <strong className={styles.highlightValue}>{reviewStats.independentColdSolves}</strong>{' '}
            cold solves ({reviewStats.successRate}% accuracy)
          </div>
          <div className={styles.progressTrack}>
            <div
              className={styles.progressFill}
              style={{
                width: `${reviewStats.successRate}%`,
                background: 'linear-gradient(90deg, #10b981, #34d399)',
              }}
            />
          </div>
        </div>
        <div className={styles.footer}>
          <span>
            {reviewStats.easy} Easy · {reviewStats.struggled} Struggled
          </span>
          <span style={{ color: 'var(--text-dim)' }}>Lifetime</span>
        </div>
      </div>

      {/* 5. Practice Streak */}
      <div className={styles.statCard}>
        <div>
          <div className={styles.cardTop}>
            <span className={styles.label}>Active Streak</span>
            <div className={styles.iconWrapper}>
              <Flame size={16} color="#f59e0b" />
            </div>
          </div>
          <div className={styles.value} style={{ color: '#fbbf24' }}>
            {streak.current} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>days</span>
          </div>
          <div className={styles.subValue}>
            Longest recorded streak: <strong style={{ color: 'var(--text-main)' }}>{streak.longest} days</strong>
          </div>
        </div>
        <div className={styles.footer}>
          <span>
            {streak.current > 0 ? '🔥 Streak active today!' : 'Review a problem to ignite streak'}
          </span>
        </div>
      </div>
    </div>
  );
};
