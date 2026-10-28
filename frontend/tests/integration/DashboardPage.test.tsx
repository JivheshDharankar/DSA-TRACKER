import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { DashboardPage } from '../../src/pages/DashboardPage';
import * as dashboardApi from '../../src/api/dashboard.api';
import * as problemsApi from '../../src/api/problems.api';
import * as patternsApi from '../../src/api/patterns.api';
import { createMockProblem } from '../fixtures/problem.fixture';
import { createMockUser } from '../fixtures/user.fixture';
import { ActivityHeatmapDay, DashboardData, User } from '../../src/types';

vi.mock('../../src/api/dashboard.api', () => ({
  fetchDashboardData: vi.fn(),
}));

vi.mock('../../src/api/problems.api', () => ({
  createProblem: vi.fn(),
}));

vi.mock('../../src/api/patterns.api', () => ({
  fetchPatterns: vi.fn(),
  fetchProblemPatterns: vi.fn(),
  syncProblemPatterns: vi.fn(),
}));

/**
 * The dashboard only reads `user` from the session, so the provider is replaced by the
 * smallest possible stand-in; `authState.user` is reset per test.
 */
const authState = vi.hoisted(() => ({ user: null as User | null }));
vi.mock('../../src/context/AuthContext', () => ({
  useAuth: () => ({ user: authState.user }),
}));

/**
 * DSA Tracker — Dashboard integration tests (Phase 5)
 * ===================================================
 * Behaviour-level coverage for the redesigned page: the four render states, the
 * preserved copy and navigation targets, and a representative sample of the existing
 * calculations. It deliberately does not assert on CSS or layout.
 */

const createHeatmap = (): ActivityHeatmapDay[] => {
  const days: ActivityHeatmapDay[] = [];
  // 2025-10-12 is a Sunday, so the first week column needs no padding.
  const start = Date.UTC(2025, 9, 12);

  for (let i = 0; i < 365; i += 1) {
    const date = new Date(start + i * 86_400_000);
    const count = i % 7 === 0 ? 3 : i % 3 === 0 ? 1 : 0;

    days.push({
      date: date.toISOString().slice(0, 10),
      count,
      easy: count,
      struggled: 0,
      hint: 0,
      forgot: 0,
      level: count >= 2 ? 2 : count === 1 ? 1 : 0,
    });
  }

  return days;
};

const createDashboardData = (overrides: Partial<DashboardData> = {}): DashboardData => ({
  user: { name: 'Ada Lovelace', email: 'ada@example.com' },
  reviewQueue: { dueNow: 3, overdue: 1, dueToday: 2, upcoming: 7 },
  problemStats: {
    total: 10,
    solved: 4,
    attempted: 3,
    notStarted: 3,
    locked: 2,
    unlocked: 8,
    college: { total: 6, solved: 3, attempted: 2, notStarted: 1 },
    personal: { total: 4, solved: 1, attempted: 1, notStarted: 2 },
  },
  reviewStats: {
    totalReviews: 12,
    easy: 6,
    struggled: 3,
    hint: 2,
    forgot: 1,
    independentColdSolves: 5,
    successRate: 75,
  },
  retention: { learning: 2, familiar: 1, independent: 4, strong: 3 },
  timing: { onTime: 6, late: 2, early: 1, averageLatenessDays: 2 },
  streak: { current: 5, longest: 12, lastActiveDate: '2026-10-09' },
  activityHeatmap: createHeatmap(),
  patternSummary: {
    totalPatterns: 6,
    strong: 2,
    independent: 2,
    familiar: 1,
    learning: 1,
    strongestPatterns: [
      {
        id: 'pat-1',
        name: 'Two Pointers',
        slug: 'two-pointers',
        score: 82,
        masteryLevel: 'Strong',
        problemCount: 4,
      },
      {
        id: 'pat-2',
        name: 'Sliding Window',
        slug: 'sliding-window',
        score: 64,
        masteryLevel: 'Independent',
        problemCount: 3,
      },
    ],
    needsPracticePatterns: [
      {
        id: 'pat-3',
        name: 'Dynamic Programming',
        slug: 'dynamic-programming',
        score: 28,
        masteryLevel: 'Learning',
        problemCount: 2,
      },
    ],
  },
  recentActivity: [
    {
      id: 'rev-1',
      problemId: 'prob-1',
      problemTitle: 'Two Sum',
      problemSection: 'PERSONAL',
      problemDifficulty: 'Easy',
      recallResult: 'EASY',
      timingStatus: 'ON_TIME',
      latenessDays: 0,
      coldSolve: true,
      reviewedAt: new Date().toISOString(),
      primaryPatternName: 'Two Pointers',
    },
    {
      id: 'rev-2',
      problemId: 'prob-2',
      problemTitle: 'Merge Intervals',
      problemSection: 'COLLEGE',
      problemDifficulty: 'Medium',
      recallResult: 'STRUGGLED',
      timingStatus: 'LATE',
      latenessDays: 2,
      coldSolve: null,
      reviewedAt: '2026-10-07T10:00:00.000Z',
      primaryPatternName: null,
    },
  ],
  ...overrides,
});

const renderDashboard = () =>
  render(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>
  );

const populatedHeading = () => screen.findByRole('heading', { name: "Today's Revision Queue" });

describe('DashboardPage (Phase 5)', () => {
  const heatmap = createHeatmap();
  const heatmapTotal = heatmap.reduce((total, day) => total + day.count, 0);

  beforeEach(() => {
    vi.clearAllMocks();
    authState.user = createMockUser({ name: 'Grace Hopper' });
    vi.mocked(patternsApi.fetchPatterns).mockResolvedValue([]);
    vi.mocked(patternsApi.fetchProblemPatterns).mockResolvedValue([]);
    vi.mocked(patternsApi.syncProblemPatterns).mockResolvedValue([]);
  });

  describe('render states', () => {
    it('shows the page header and one loading status while the dashboard is fetching', () => {
      vi.mocked(dashboardApi.fetchDashboardData).mockReturnValue(new Promise(() => {}));

      renderDashboard();

      expect(
        screen.getByRole('heading', { level: 2, name: 'Welcome back, Grace Hopper' })
      ).toBeInTheDocument();

      const status = screen.getByRole('status');
      expect(status).toHaveTextContent('Loading your dashboard');
      expect(
        screen.queryByRole('heading', { name: "Today's Revision Queue" })
      ).not.toBeInTheDocument();
    });

    it('renders the error state with the failure message and refetches when Retry is pressed', async () => {
      const user = userEvent.setup();
      vi.mocked(dashboardApi.fetchDashboardData).mockRejectedValueOnce(
        new Error('Dashboard request failed')
      );

      renderDashboard();

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent('Something went wrong loading your dashboard.');
      expect(alert).toHaveTextContent('Dashboard request failed');

      vi.mocked(dashboardApi.fetchDashboardData).mockResolvedValue(createDashboardData());
      await user.click(screen.getByRole('button', { name: /retry/i }));

      expect(
        await screen.findByRole('heading', { name: "Today's Revision Queue" })
      ).toBeInTheDocument();
      expect(dashboardApi.fetchDashboardData).toHaveBeenCalledTimes(2);
    });

    it('renders the empty state instead of the panels when the account has no problems', async () => {
      const base = createDashboardData();
      vi.mocked(dashboardApi.fetchDashboardData).mockResolvedValue({
        ...base,
        problemStats: { ...base.problemStats, total: 0, solved: 0, attempted: 0, notStarted: 0 },
      });

      renderDashboard();

      expect(
        await screen.findByRole('heading', { name: /your dsa journey starts here/i })
      ).toBeInTheDocument();
      expect(
        screen.getByText(/add your first problem to begin building your revision history/i)
      ).toBeInTheDocument();
      expect(screen.getAllByRole('button', { name: 'Add Problem' })).toHaveLength(2);
      expect(
        screen.queryByRole('heading', { name: "Today's Revision Queue" })
      ).not.toBeInTheDocument();
    });

    it('renders every dashboard area, the greeting and the subtitle for a populated account', async () => {
      vi.mocked(dashboardApi.fetchDashboardData).mockResolvedValue(createDashboardData());

      renderDashboard();

      expect(await populatedHeading()).toBeInTheDocument();
      expect(
        screen.getByRole('heading', { level: 2, name: 'Welcome back, Grace Hopper' })
      ).toBeInTheDocument();
      expect(
        screen.getByText('Your spaced repetition command center & DSA pattern tracker.')
      ).toBeInTheDocument();

      for (const name of [
        'Completion & Section Progress',
        'Review Analytics',
        'Pattern Mastery',
        'Recent Practice Activity',
        'Practice Activity Heatmap',
        'Recall Accuracy',
        'Retention Distribution',
        'Revision Timing',
        'Strongest Patterns',
        'Needs Practice',
      ]) {
        expect(screen.getByRole('heading', { name })).toBeInTheDocument();
      }
    });

    it('falls back to the dashboard payload name when there is no session user', async () => {
      authState.user = null;
      vi.mocked(dashboardApi.fetchDashboardData).mockResolvedValue(createDashboardData());

      renderDashboard();

      expect(
        await screen.findByRole('heading', { level: 2, name: 'Welcome back, Ada Lovelace' })
      ).toBeInTheDocument();
    });
  });

  describe('preserved calculations', () => {
    it('shows the headline metrics and falls back to zero for absent locked/unlocked counts', async () => {
      const base = createDashboardData();
      // The API can omit these counters; the page has always guarded them with `?? 0`.
      const statsWithoutLocks = { ...base.problemStats } as Record<string, unknown>;
      delete statsWithoutLocks.locked;
      delete statsWithoutLocks.unlocked;

      vi.mocked(dashboardApi.fetchDashboardData).mockResolvedValue({
        ...base,
        problemStats: statsWithoutLocks as unknown as DashboardData['problemStats'],
      });

      renderDashboard();

      expect(await populatedHeading()).toBeInTheDocument();
      expect(screen.getByText('Total Problems')).toBeInTheDocument();
      expect(screen.getByText('40% of 10')).toBeInTheDocument();
      expect(screen.getByText('3 not started')).toBeInTheDocument();
      expect(screen.getByText('75% accuracy · 5 cold solves')).toBeInTheDocument();
      expect(screen.getByText('longest 12 days')).toBeInTheDocument();
      expect(screen.getByText('0 unlocked')).toBeInTheDocument();
      expect(screen.getByText('Locked')).toBeInTheDocument();
    });

    it('keeps the solved-percentage formulas for overall, College and Personal progress', async () => {
      vi.mocked(dashboardApi.fetchDashboardData).mockResolvedValue(createDashboardData());

      renderDashboard();
      await populatedHeading();

      expect(screen.getByText('4 of 10 solved (40%)')).toBeInTheDocument();
      expect(screen.getByText('3 of 6 solved (50%)')).toBeInTheDocument();
      expect(screen.getByText('1 of 4 solved (25%)')).toBeInTheDocument();

      const overall = screen.getByRole('progressbar', { name: 'Overall solved' });
      expect(overall).toHaveAttribute('aria-valuenow', '4');
      expect(overall).toHaveAttribute('aria-valuemax', '10');
    });

    it('keeps the recall, retention and timing percentages', async () => {
      vi.mocked(dashboardApi.fetchDashboardData).mockResolvedValue(createDashboardData());

      renderDashboard();
      await populatedHeading();

      // Recall: 6/12, 3/12 and 2/12.
      expect(screen.getByText('50% (6)')).toBeInTheDocument();
      expect(screen.getByText('25% (3)')).toBeInTheDocument();
      expect(screen.getByText('17% (2)')).toBeInTheDocument();
      expect(screen.getByText('9 (75%)')).toBeInTheDocument();

      // Retention: 3/10 strong, 4/10 independent.
      expect(screen.getByText('30% (3)')).toBeInTheDocument();
      expect(screen.getByText('40% (4)')).toBeInTheDocument();
      expect(screen.getByText('7 problems')).toBeInTheDocument();

      // Timing: 6/9 on time.
      expect(screen.getByText('67% (6)')).toBeInTheDocument();
      expect(screen.getByText('67% on schedule')).toBeInTheDocument();
      expect(screen.getByText('Avg lateness: 2 days')).toBeInTheDocument();
    });
  });

  describe('review queue behaviour', () => {
    it('keeps the due-now copy and the /review action when reviews are due', async () => {
      vi.mocked(dashboardApi.fetchDashboardData).mockResolvedValue(
        createDashboardData({ reviewQueue: { dueNow: 3, overdue: 1, dueToday: 2, upcoming: 7 } })
      );

      renderDashboard();
      await populatedHeading();

      expect(
        screen.getByText('You have 3 problems due for spaced repetition review today.')
      ).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /start reviewing \(3 due\)/i })).toHaveAttribute(
        'href',
        '/review'
      );
      expect(screen.getByText('Due Now')).toBeInTheDocument();
      expect(screen.getByText('Overdue')).toBeInTheDocument();
      expect(screen.getByText('Due Today')).toBeInTheDocument();
      expect(screen.getByText('Upcoming')).toBeInTheDocument();
    });

    it('uses the singular wording for a single due problem', async () => {
      vi.mocked(dashboardApi.fetchDashboardData).mockResolvedValue(
        createDashboardData({ reviewQueue: { dueNow: 1, overdue: 0, dueToday: 1, upcoming: 0 } })
      );

      renderDashboard();
      await populatedHeading();

      expect(
        screen.getByText('You have 1 problem due for spaced repetition review today.')
      ).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /start reviewing \(1 due\)/i })).toBeInTheDocument();
    });

    it('shows the caught-up state when nothing is due', async () => {
      vi.mocked(dashboardApi.fetchDashboardData).mockResolvedValue(
        createDashboardData({ reviewQueue: { dueNow: 0, overdue: 0, dueToday: 0, upcoming: 4 } })
      );

      renderDashboard();
      await populatedHeading();

      expect(
        screen.getByText(
          'All scheduled reviews are complete for today. Your memory traces are reinforced!'
        )
      ).toBeInTheDocument();
      expect(screen.getByText('All Caught Up!')).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /start reviewing/i })).not.toBeInTheDocument();
    });
  });

  describe('navigation targets', () => {
    it('preserves the review, section, pattern and problem links', async () => {
      vi.mocked(dashboardApi.fetchDashboardData).mockResolvedValue(createDashboardData());

      renderDashboard();
      await populatedHeading();

      expect(screen.getByRole('link', { name: 'View College DSA problems' })).toHaveAttribute(
        'href',
        '/college-dsa'
      );
      expect(screen.getByRole('link', { name: 'View Personal DSA problems' })).toHaveAttribute(
        'href',
        '/personal-dsa'
      );
      expect(screen.getByRole('link', { name: /view library/i })).toHaveAttribute(
        'href',
        '/patterns'
      );
      expect(screen.getByRole('link', { name: /all patterns/i })).toHaveAttribute(
        'href',
        '/patterns'
      );
      expect(
        screen.getByRole('link', { name: 'View pattern Two Pointers, mastery score 82' })
      ).toHaveAttribute('href', '/patterns/pat-1');
      expect(
        screen.getByRole('link', { name: 'Practice pattern Dynamic Programming, mastery score 28' })
      ).toHaveAttribute('href', '/patterns/pat-3');
      expect(screen.getByRole('link', { name: 'Two Sum' })).toHaveAttribute(
        'href',
        '/problems/prob-1'
      );
    });
  });

  describe('pattern progress behaviour', () => {
    it('renders pattern scores, mastery levels and problem counts', async () => {
      vi.mocked(dashboardApi.fetchDashboardData).mockResolvedValue(createDashboardData());

      renderDashboard();
      await populatedHeading();

      const strongest = screen.getByRole('link', {
        name: 'View pattern Two Pointers, mastery score 82',
      });
      expect(within(strongest).getByText('Strong')).toBeInTheDocument();
      expect(within(strongest).getByText('82%')).toBeInTheDocument();
      expect(within(strongest).getByText('4 problems')).toBeInTheDocument();

      const needsPractice = screen.getByRole('link', {
        name: 'Practice pattern Dynamic Programming, mastery score 28',
      });
      expect(within(needsPractice).getByText('Learning')).toBeInTheDocument();
      expect(within(needsPractice).getByText('28%')).toBeInTheDocument();
      expect(within(needsPractice).getByText('2 problems')).toBeInTheDocument();
    });

    it('shows both pattern empty states when no pattern qualifies', async () => {
      const base = createDashboardData();
      vi.mocked(dashboardApi.fetchDashboardData).mockResolvedValue({
        ...base,
        patternSummary: {
          ...base.patternSummary,
          strongestPatterns: [],
          needsPracticePatterns: [],
        },
      });

      renderDashboard();
      await populatedHeading();

      expect(
        screen.getByText('Solve problems attached to patterns to build mastery')
      ).toBeInTheDocument();
      expect(screen.getByText('All patterns have reached strong mastery!')).toBeInTheDocument();
    });
  });

  describe('activity timeline behaviour', () => {
    it('renders recall outcome, cold solve, timing and relative dates per review', async () => {
      vi.mocked(dashboardApi.fetchDashboardData).mockResolvedValue(createDashboardData());

      renderDashboard();
      await screen.findByRole('heading', { name: 'Recent Practice Activity' });

      expect(screen.getByText('Last 2 reviews')).toBeInTheDocument();

      const first = screen.getByText('Two Sum').closest('li') as HTMLElement;
      expect(within(first).getByText('EASY')).toBeInTheDocument();
      expect(within(first).getByText('Cold Solve')).toBeInTheDocument();
      expect(within(first).getByText('Today')).toBeInTheDocument();
      expect(within(first).getByText('Two Pointers')).toBeInTheDocument();
      expect(within(first).getByText('On Time')).toBeInTheDocument();

      const second = screen.getByText('Merge Intervals').closest('li') as HTMLElement;
      expect(within(second).getByText('STRUGGLED')).toBeInTheDocument();
      expect(within(second).getByText('Late by 2 days')).toBeInTheDocument();
      expect(within(second).getByText('College')).toBeInTheDocument();
      expect(within(second).queryByText('Cold Solve')).not.toBeInTheDocument();
    });

    it('shows the activity empty state when no reviews are logged', async () => {
      vi.mocked(dashboardApi.fetchDashboardData).mockResolvedValue(
        createDashboardData({ recentActivity: [] })
      );

      renderDashboard();
      await populatedHeading();

      expect(screen.getByText('No reviews logged yet')).toBeInTheDocument();
      expect(
        screen.getByText('Complete reviews in your queue to populate your activity feed.')
      ).toBeInTheDocument();
      expect(screen.getByText('Last 0 reviews')).toBeInTheDocument();
    });
  });

  describe('activity heatmap', () => {
    it('renders the yearly total, streak summary, day cells and the legend', async () => {
      vi.mocked(dashboardApi.fetchDashboardData).mockResolvedValue(createDashboardData());

      renderDashboard();
      await populatedHeading();

      expect(
        screen.getByText(`${heatmapTotal} revisions in the last 12 months`)
      ).toBeInTheDocument();
      expect(screen.getByText('5 Day Streak')).toBeInTheDocument();
      expect(screen.getByText('Longest Practice Streak:')).toBeInTheDocument();
      expect(screen.getByText('12 days')).toBeInTheDocument();
      expect(screen.getByText('Less')).toBeInTheDocument();
      expect(screen.getByText('More')).toBeInTheDocument();

      // 53 of the 365 days have three reviews each; every day exposes an accessible name.
      expect(screen.getAllByRole('button', { name: /: 3 reviews$/ })).toHaveLength(53);
      expect(screen.getAllByRole('button', { name: /: 0 reviews$/ }).length).toBeGreaterThan(0);
    });
  });

  describe('add problem action', () => {
    it('opens the Add Problem modal in the Personal section from the header', async () => {
      const user = userEvent.setup();
      vi.mocked(dashboardApi.fetchDashboardData).mockResolvedValue(createDashboardData());

      renderDashboard();
      await populatedHeading();

      await user.click(screen.getByRole('button', { name: 'Add Problem' }));

      expect(screen.getByText('Add Personal DSA Problem')).toBeInTheDocument();
      expect(screen.getByText('Auto-generated on save')).toBeInTheDocument();
      await waitFor(() => expect(patternsApi.fetchPatterns).toHaveBeenCalled());
    });

    it('creates a problem and reloads the dashboard', async () => {
      const user = userEvent.setup();
      vi.mocked(dashboardApi.fetchDashboardData).mockResolvedValue(createDashboardData());
      vi.mocked(problemsApi.createProblem).mockResolvedValue(
        createMockProblem({ id: 'created-1', title: 'New Problem', section: 'PERSONAL' })
      );

      renderDashboard();
      await populatedHeading();

      await user.click(screen.getByRole('button', { name: 'Add Problem' }));
      await user.type(
        screen.getByPlaceholderText(/e\.g\. Longest Substring/i),
        'New Problem'
      );
      await user.type(screen.getByPlaceholderText(/e\.g\. Arrays, Strings, Trees, DP/i), 'Arrays');
      await user.click(screen.getByRole('button', { name: /save problem/i }));

      await waitFor(() =>
        expect(problemsApi.createProblem).toHaveBeenCalledWith(
          expect.objectContaining({ section: 'PERSONAL', title: 'New Problem', topic: 'Arrays' })
        )
      );
      await waitFor(() => expect(dashboardApi.fetchDashboardData).toHaveBeenCalledTimes(2));
    });
  });
});
