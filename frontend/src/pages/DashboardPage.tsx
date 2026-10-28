import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Sparkles } from 'lucide-react';
import { fetchDashboardData } from '../api/dashboard.api';
import { createProblem } from '../api/problems.api';
import { DashboardData, SectionType, CreateProblemInput, Problem } from '../types';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { Skeleton } from '../components/ui/Skeleton';
import { ReviewQueueHero } from '../components/dashboard/ReviewQueueHero';
import { MetricStrip, ProgressPanel } from '../components/dashboard/QuickStatsGrid';
import { PerformanceSummary } from '../components/dashboard/PerformanceSummary';
import { PatternMasterySummary } from '../components/dashboard/PatternMasterySummary';
import { RecentActivityFeed } from '../components/dashboard/RecentActivityFeed';
import { ActivityHeatmap } from '../components/dashboard/ActivityHeatmap';
import { ProblemModal } from '../components/problems/ProblemModal';
import styles from './DashboardPage.module.css';

/**
 * DSA Tracker — Dashboard (Phase 5)
 * =================================
 * The page owns the data and the composition; the eight areas below are the approved
 * structure, and all of their placement lives in `DashboardPage.module.css`:
 *
 *   1. PageHeader              (local, below — the page's <h2> + the Add Problem action;
 *                               the shell topbar owns the document <h1>)
 *   2. TodayReviewPanel        → ReviewQueueHero
 *   3. MetricStrip             → QuickStatsGrid (MetricStrip)
 *   4. ProgressPanel           → QuickStatsGrid (ProgressPanel)
 *   5. AnalyticsPanel          → PerformanceSummary
 *   6. PatternProgressList     → PatternMasterySummary
 *   7. ActivityTimeline        → RecentActivityFeed
 *   8. ActivityHeatmap         → ActivityHeatmap (always its own full-width area)
 *
 * The fetched payload, the endpoint and every calculation inside the areas are
 * unchanged; only the presentation moved onto the Phase 0/2 design system and the
 * Phase 3 shell. Loading, error and zero states use the shared primitives (`Skeleton`,
 * `ErrorState`, `EmptyState`) instead of bespoke markup.
 *
 * The header is rendered in every state, so the page keeps its identity while data
 * loads and the `Add Problem` action stays reachable.
 */

interface PageHeaderProps {
  displayName: string;
  onAddProblem: () => void;
}

const PageHeader: React.FC<PageHeaderProps> = ({ displayName, onAddProblem }) => (
  <header className={styles.pageHeader}>
    <div className={styles.pageHeaderText}>
      <h2 className={styles.pageTitle}>Welcome back, {displayName}</h2>
      <p className={styles.pageSubtitle}>
        Your spaced repetition command center & DSA pattern tracker.
      </p>
    </div>

    <div className={styles.pageHeaderActions}>
      <Button
        variant="primary"
        size="md"
        className={styles.headerCta}
        iconLeft={<Plus size={16} />}
        onClick={onAddProblem}
      >
        Add Problem
      </Button>
    </div>
  </header>
);

/**
 * Loading placeholder. Uses the same area classes as the real layout, so the page does
 * not jump when the data arrives. A single `role="status"` region announces the state —
 * the individual shapes are decorative and hidden from assistive technology.
 */
const DashboardSkeleton: React.FC = () => (
  <div className={styles.skeletonLayout} role="status" aria-busy="true">
    <span className="sr-only">Loading your dashboard</span>
    <div className={styles.areaMetrics}>
      <Skeleton shape="block" height={104} />
    </div>
    <div className={styles.areaToday}>
      <Skeleton shape="block" height={196} />
    </div>
    <div className={styles.areaProgress}>
      <Skeleton shape="block" height={236} />
    </div>
    <div className={styles.areaPattern}>
      <Skeleton shape="block" height={280} />
    </div>
    <div className={styles.areaAnalytics}>
      <Skeleton shape="block" height={248} />
    </div>
    <div className={styles.areaTimeline}>
      <Skeleton shape="block" height={248} />
    </div>
    <div className={styles.areaHeatmap}>
      <Skeleton shape="block" height={220} />
    </div>
  </div>
);

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

  const openAddProblemModal = useCallback(() => {
    setAddSection('PERSONAL');
    setIsAddModalOpen(true);
  }, []);

  const handleCreateProblem = async (input: CreateProblemInput): Promise<Problem | void> => {
    const created = await createProblem(input);
    await loadDashboard();
    return created;
  };

  const displayName = user?.name || data?.user.name || 'Engineer';

  return (
    <div className={styles.page}>
      <PageHeader displayName={displayName} onAddProblem={openAddProblemModal} />

      {isLoading ? (
        <DashboardSkeleton />
      ) : error || !data ? (
        <ErrorState
          variant="section"
          title="Something went wrong loading your dashboard."
          message={error || 'Unable to retrieve dashboard analytics.'}
          onRetry={loadDashboard}
          retryLabel="Retry"
        />
      ) : data.problemStats.total === 0 ? (
        <EmptyState
          variant="compact"
          titleAs="h2"
          icon={<Sparkles size={24} />}
          title="Your DSA journey starts here."
          description="Add your first problem to begin building your revision history and pattern mastery."
          primaryAction={
            <Button iconLeft={<Plus size={16} />} onClick={openAddProblemModal}>
              Add Problem
            </Button>
          }
        />
      ) : (
        <div className={styles.layout}>
          <div className={styles.areaMetrics}>
            <MetricStrip
              problemStats={data.problemStats}
              reviewStats={data.reviewStats}
              streak={data.streak}
            />
          </div>

          <div className={styles.areaToday}>
            <ReviewQueueHero
              dueNow={data.reviewQueue.dueNow}
              overdue={data.reviewQueue.overdue}
              dueToday={data.reviewQueue.dueToday}
              upcoming={data.reviewQueue.upcoming}
            />
          </div>

          <div className={styles.areaProgress}>
            <ProgressPanel problemStats={data.problemStats} />
          </div>

          <div className={styles.areaPattern}>
            <PatternMasterySummary patternSummary={data.patternSummary} />
          </div>

          <div className={styles.areaAnalytics}>
            <PerformanceSummary
              reviewStats={data.reviewStats}
              retention={data.retention}
              timing={data.timing}
              problemTotal={data.problemStats.total}
            />
          </div>

          <div className={styles.areaTimeline}>
            <RecentActivityFeed recentActivity={data.recentActivity} />
          </div>

          <div className={styles.areaHeatmap}>
            <ActivityHeatmap
              data={data.activityHeatmap}
              currentStreak={data.streak.current}
              longestStreak={data.streak.longest}
            />
          </div>
        </div>
      )}

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
