import React, { useEffect, useState, useCallback } from 'react';
import { Plus, RefreshCw, AlertCircle, Sparkles } from 'lucide-react';
import { fetchDashboardData } from '../api/dashboard.api';
import { createProblem } from '../api/problems.api';
import { DashboardData, SectionType, CreateProblemInput, Problem } from '../types';
import { useAuth } from '../context/AuthContext';
import { ReviewQueueHero } from '../components/dashboard/ReviewQueueHero';
import { QuickStatsGrid } from '../components/dashboard/QuickStatsGrid';
import { ActivityHeatmap } from '../components/dashboard/ActivityHeatmap';
import { PerformanceSummary } from '../components/dashboard/PerformanceSummary';
import { PatternMasterySummary } from '../components/dashboard/PatternMasterySummary';
import { RecentActivityFeed } from '../components/dashboard/RecentActivityFeed';
import { ProblemModal } from '../components/problems/ProblemModal';
import styles from './DashboardPage.module.css';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [addSection, setAddSection] = useState<SectionType>('PERSONAL');

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const dashRes = await fetchDashboardData();
      setData(dashRes);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong loading your dashboard.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  // 1. Loading State (Skeletons)
  if (isLoading) {
    return (
      <div className={styles.page}>
        <div className={styles.skeletonContainer}>
          <div className={styles.skeletonHeader} />
          <div className={styles.skeletonHero} />
          <div className={styles.skeletonGrid}>
            <div className={styles.skeletonCard} />
            <div className={styles.skeletonCard} />
            <div className={styles.skeletonCard} />
            <div className={styles.skeletonCard} />
          </div>
          <div className={styles.skeletonHeatmap} />
        </div>
      </div>
    );
  }

  // 2. Error State
  if (error || !data) {
    return (
      <div className={styles.page}>
        <div className={styles.errorCard}>
          <div className={styles.errorIcon}>
            <AlertCircle size={32} />
          </div>
          <h2 className={styles.errorTitle}>Something went wrong loading your dashboard.</h2>
          <p className={styles.errorDesc}>{error || 'Unable to retrieve dashboard analytics.'}</p>
          <button type="button" onClick={loadDashboard} className={styles.retryBtn}>
            <RefreshCw size={16} />
            <span>Retry</span>
          </button>
        </div>
      </div>
    );
  }

  const handleCreateProblem = async (input: CreateProblemInput): Promise<Problem | void> => {
    const created = await createProblem(input);
    await loadDashboard();
    return created;
  };

  const isZeroState = data.problemStats.total === 0;
  const displayName = user?.name || data.user.name || 'Engineer';

  return (
    <div className={styles.page}>
      {/* 1. Welcome Header */}
      <header className={styles.header}>
        <div className={styles.welcomeText}>
          <h1 className={styles.title}>Welcome back, {displayName}</h1>
          <p className={styles.subtitle}>
            Your spaced repetition command center & DSA pattern tracker.
          </p>
        </div>

        <div className={styles.headerActions}>
          <button
            type="button"
            onClick={() => {
              setAddSection('PERSONAL');
              setIsAddModalOpen(true);
            }}
            className={styles.newProblemBtn}
          >
            <Plus size={16} />
            <span>Add Problem</span>
          </button>
        </div>
      </header>

      {/* Empty State Banner (if new user with 0 problems) */}
      {isZeroState ? (
        <div className={styles.emptyHero}>
          <div className={styles.emptyIconWrapper}>
            <Sparkles size={28} />
          </div>
          <h2 className={styles.emptyHeading}>Your DSA journey starts here.</h2>
          <p className={styles.emptyText}>
            Add your first problem to begin building your revision history and pattern mastery.
          </p>
          <button
            type="button"
            onClick={() => {
              setAddSection('PERSONAL');
              setIsAddModalOpen(true);
            }}
            className={styles.newProblemBtn}
          >
            <Plus size={16} />
            <span>Add Problem</span>
          </button>
        </div>
      ) : (
        <>
          {/* 2. Today's Review Hero */}
          <ReviewQueueHero
            dueNow={data.reviewQueue.dueNow}
            overdue={data.reviewQueue.overdue}
            dueToday={data.reviewQueue.dueToday}
            upcoming={data.reviewQueue.upcoming}
          />

          {/* 3. Quick Stats Grid */}
          <QuickStatsGrid
            problemStats={data.problemStats}
            reviewStats={data.reviewStats}
            streak={data.streak}
          />

          {/* 4. Activity Heatmap */}
          <ActivityHeatmap
            data={data.activityHeatmap}
            currentStreak={data.streak.current}
            longestStreak={data.streak.longest}
          />

          {/* 5. Review Performance & Retention Analytics */}
          <PerformanceSummary
            reviewStats={data.reviewStats}
            retention={data.retention}
            timing={data.timing}
            problemTotal={data.problemStats.total}
          />

          {/* 6. Pattern Mastery */}
          <PatternMasterySummary patternSummary={data.patternSummary} />

          {/* 7. Recent Activity */}
          <RecentActivityFeed recentActivity={data.recentActivity} />
        </>
      )}

      {/* Add Problem Modal */}
      <ProblemModal
        isOpen={isAddModalOpen}
        section={addSection}
        onClose={() => setIsAddModalOpen(false)}
        onSubmitCreate={handleCreateProblem}
        onSubmitUpdate={async () => {}}
      />
    </div>
  );
};
