import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { LockedProblemsPage } from '../../src/pages/LockedProblemsPage';
import * as masteryApi from '../../src/api/mastery.api';
import { ProblemMasteryOverviewItem } from '../../src/types';

vi.mock('../../src/api/mastery.api', () => ({
  fetchMasteryOverview: vi.fn(),
  fetchProblemMastery: vi.fn(),
  evaluateProblemMastery: vi.fn(),
}));

const allGatesPassed = {
  solved: { passed: true, status: 'Solved', requiredStatus: 'Solved' },
  srsEvidence: {
    passed: true,
    successfulReviewsCount: 3,
    requiredReviewsCount: 3,
    hasStageThreeMilestone: true,
    maxStageReached: 5,
  },
  coldRecall: { passed: true, qualifyingColdSolvesCount: 2, requiredColdSolvesCount: 2 },
  recentSuccess: {
    passed: true,
    latestOutcome: 'EASY',
    latestTimestamp: '2026-10-01T00:00:00.000Z',
    totalReviewsCount: 3,
  },
};

const createItem = (
  overrides: Partial<ProblemMasteryOverviewItem> = {},
  problemOverrides: Partial<ProblemMasteryOverviewItem['problem']> = {}
): ProblemMasteryOverviewItem => ({
  problem: {
    id: 'prob-locked',
    title: 'Binary Search',
    sNo: 4,
    section: 'COLLEGE',
    difficulty: 'Medium',
    status: 'Solved',
    topic: 'Searching',
    retentionLevel: 'Locked',
    masteryStatus: 'LOCKED',
    lockedAt: '2026-10-02T00:00:00.000Z',
    unlockedAt: null,
    lockVersion: 2,
    ...problemOverrides,
  },
  isEligible: true,
  gates: allGatesPassed,
  ...overrides,
});

const inProgressItem = createItem(
  {
    isEligible: false,
    gates: {
      solved: { passed: true, status: 'Solved', requiredStatus: 'Solved' },
      srsEvidence: {
        passed: false,
        successfulReviewsCount: 1,
        requiredReviewsCount: 3,
        hasStageThreeMilestone: false,
        maxStageReached: 1,
      },
      coldRecall: {
        passed: false,
        qualifyingColdSolvesCount: 0,
        requiredColdSolvesCount: 2,
      },
      recentSuccess: {
        passed: true,
        latestOutcome: 'STRUGGLED',
        latestTimestamp: '2026-09-28T00:00:00.000Z',
        totalReviewsCount: 1,
      },
    },
  },
  {
    id: 'prob-progress',
    title: 'Sliding Window',
    sNo: 9,
    section: 'PERSONAL',
    difficulty: 'Hard',
    status: 'Attempted',
    retentionLevel: 'Learning',
    masteryStatus: 'UNLOCKED',
    lockedAt: null,
    lockVersion: 0,
  }
);

/** The `<li>` that wraps one problem card, scoped for assertions on that card only. */
const cardFor = (title: string) => {
  const link = screen.getByRole('link', { name: title });
  const card = link.closest('li');
  if (!card) {
    throw new Error(`No card found for ${title}`);
  }
  return within(card as HTMLElement);
};

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/problems/locked']}>
      <Routes>
        <Route path="/problems/locked" element={<LockedProblemsPage />} />
        <Route path="/problems/:id" element={<div>Problem detail destination</div>} />
        <Route path="/review" element={<div>Review queue destination</div>} />
        <Route path="/college-dsa" element={<div>College tracker destination</div>} />
        <Route path="/personal-dsa" element={<div>Personal tracker destination</div>} />
      </Routes>
    </MemoryRouter>
  );

describe('LockedProblemsPage (Locked Mastery redesign)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reserves the list with a labelled loading state and fetches the overview once', () => {
    vi.mocked(masteryApi.fetchMasteryOverview).mockReturnValue(new Promise(() => {}));

    renderPage();

    expect(screen.getByText('Loading locked problems')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(masteryApi.fetchMasteryOverview).toHaveBeenCalledTimes(1);
  });

  it('renders the vault stats, the gate guide and both mastery states', async () => {
    vi.mocked(masteryApi.fetchMasteryOverview).mockResolvedValue([
      createItem(),
      inProgressItem,
    ]);

    renderPage();

    expect(await screen.findByRole('heading', { name: 'Locked Problems' })).toBeInTheDocument();

    // Catalog-wide counts in the header and in the stats.
    expect(screen.getByText('1 locked')).toBeInTheDocument();
    expect(screen.getByText('1 in progress')).toBeInTheDocument();
    expect(screen.getByText('Sealed by verified recall')).toBeInTheDocument();
    expect(screen.getByText('All four gates met')).toBeInTheDocument();

    // The four gates are explained exactly as the evaluator implements them.
    expect(screen.getByText('The four qualification gates')).toBeInTheDocument();
    expect(screen.getByText(/3 successful reviews/)).toBeInTheDocument();
    expect(screen.getByText(/2 successful cold solves/)).toBeInTheDocument();

    // Locked card: sealed state, lock version and lock date.
    expect(screen.getByRole('link', { name: 'Binary Search' })).toHaveAttribute(
      'href',
      '/problems/prob-locked'
    );
    expect(screen.getByText('Locked · v2')).toBeInTheDocument();
    expect(screen.getByText(/seal v2/)).toBeInTheDocument();
    expect(screen.getByText(/Locked on Oct 2, 2026/)).toBeInTheDocument();

    // In-progress card: the first failing gate drives the next action.
    expect(screen.getByRole('link', { name: 'Sliding Window' })).toHaveAttribute(
      'href',
      '/problems/prob-progress'
    );

    const inProgressCard = cardFor('Sliding Window');
    expect(inProgressCard.getByText('In progress')).toBeInTheDocument();
    // Gates A and D pass; B and C are still open.
    expect(inProgressCard.getByText('2/4 gates passed')).toBeInTheDocument();
    expect(
      inProgressCard.getByText(/Needs 2 more successful reviews and a review at stage 3 or later/)
    ).toBeInTheDocument();

    // Per-gate numbers come straight from the payload.
    expect(inProgressCard.getByText(/1\/3 reviews/)).toBeInTheDocument();
    expect(inProgressCard.getByText(/0\/2 independent solves/)).toBeInTheDocument();
    expect(inProgressCard.getByText(/Last outcome: STRUGGLED/)).toBeInTheDocument();
  });

  it('filters by mastery status while keeping catalog-wide counts', async () => {
    const user = userEvent.setup();
    vi.mocked(masteryApi.fetchMasteryOverview).mockResolvedValue([
      createItem(),
      inProgressItem,
    ]);

    renderPage();

    await screen.findByRole('link', { name: 'Binary Search' });

    const allPill = screen.getByRole('button', { name: /^All problems/ });
    expect(allPill).toHaveAttribute('aria-pressed', 'true');
    expect(allPill).toHaveTextContent('2');

    await user.click(screen.getByRole('button', { name: /^Locked mastery/ }));

    expect(screen.getByRole('link', { name: 'Binary Search' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Sliding Window' })).not.toBeInTheDocument();
    expect(screen.getByText(/^Showing/)).toHaveTextContent('Showing 1 of 2 problems');
    expect(screen.getByRole('button', { name: /^In progress/ })).toHaveTextContent('1');
  });

  it('explains the empty locked view and clears the filter in one action', async () => {
    const user = userEvent.setup();
    vi.mocked(masteryApi.fetchMasteryOverview).mockResolvedValue([inProgressItem]);

    renderPage();

    await screen.findByRole('link', { name: 'Sliding Window' });
    await user.click(screen.getByRole('button', { name: /^Locked mastery/ }));

    expect(screen.getByText('No problems locked yet')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /show all problems/i }));

    expect(screen.getByRole('link', { name: 'Sliding Window' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^All problems/ })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  it('offers the locked filter when every tracked problem is already sealed', async () => {
    const user = userEvent.setup();
    vi.mocked(masteryApi.fetchMasteryOverview).mockResolvedValue([createItem()]);

    renderPage();

    await screen.findByRole('link', { name: 'Binary Search' });
    await user.click(screen.getByRole('button', { name: /^In progress/ }));

    expect(screen.getByText('Every tracked problem is locked')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /show locked mastery/i }));
    expect(screen.getByRole('link', { name: 'Binary Search' })).toBeInTheDocument();
  });

  it('sends a brand-new account to the trackers instead of an empty filter', async () => {
    const user = userEvent.setup();
    vi.mocked(masteryApi.fetchMasteryOverview).mockResolvedValue([]);

    renderPage();

    expect(await screen.findByText('No problems to qualify yet')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^All problems/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Personal DSA' }));
    expect(await screen.findByText('Personal tracker destination')).toBeInTheDocument();
  });

  it('shows the failure state and recovers through Retry', async () => {
    const user = userEvent.setup();
    vi.mocked(masteryApi.fetchMasteryOverview)
      .mockRejectedValueOnce(new Error('Mastery service unavailable'))
      .mockResolvedValueOnce([createItem()]);

    renderPage();

    expect(await screen.findByText('Mastery service unavailable')).toBeInTheDocument();
    expect(
      screen.getByText("We couldn't load your mastery overview")
    ).toBeInTheDocument();
    expect(screen.queryByText('No problems to qualify yet')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /retry/i }));

    expect(await screen.findByRole('link', { name: 'Binary Search' })).toBeInTheDocument();
    expect(masteryApi.fetchMasteryOverview).toHaveBeenCalledTimes(2);
  });

  it('keeps the problem inspection link pointing at the problem detail route', async () => {
    vi.mocked(masteryApi.fetchMasteryOverview).mockResolvedValue([createItem()]);

    renderPage();

    await screen.findByRole('link', { name: 'Binary Search' });
    expect(screen.getByRole('link', { name: /inspect problem/i })).toHaveAttribute(
      'href',
      '/problems/prob-locked'
    );
  });

  it('keeps the Review Queue header action working', async () => {
    const user = userEvent.setup();
    vi.mocked(masteryApi.fetchMasteryOverview).mockResolvedValue([createItem()]);

    renderPage();

    await screen.findByRole('link', { name: 'Binary Search' });
    await user.click(screen.getByRole('button', { name: /review queue/i }));

    expect(await screen.findByText('Review queue destination')).toBeInTheDocument();
  });
});
