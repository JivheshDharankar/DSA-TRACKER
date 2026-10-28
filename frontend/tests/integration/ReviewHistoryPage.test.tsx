import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ReviewHistoryPage } from '../../src/pages/ReviewHistoryPage';
import * as reviewsApi from '../../src/api/reviews.api';
import { PaginatedHistory, RevisionHistoryItem } from '../../src/types';

vi.mock('../../src/api/reviews.api', () => ({
  fetchUserReviewHistory: vi.fn(),
}));

const createHistoryItem = (overrides: Partial<RevisionHistoryItem> = {}): RevisionHistoryItem => ({
  id: 'rev-1',
  userId: 'user-1',
  problemId: 'prob-1',
  reviewedAt: '2026-10-12T14:30:00.000Z',
  scheduledReviewAt: '2026-10-10T00:00:00.000Z',
  recallResult: 'EASY',
  timingStatus: 'LATE',
  latenessDays: 2,
  previousStage: 1,
  newStage: 2,
  previousIntervalDays: 3,
  newIntervalDays: 7,
  previousRetention: 'Learning',
  newRetention: 'Familiar',
  previousNextReviewDate: '2026-10-10T00:00:00.000Z',
  newNextReviewDate: '2026-10-19T00:00:00.000Z',
  timeSpentSeconds: 320,
  coldSolve: true,
  createdAt: '2026-10-12T14:30:00.000Z',
  problem: {
    id: 'prob-1',
    title: 'Invert Binary Tree',
    sNo: 7,
    section: 'PERSONAL',
    difficulty: 'Easy',
    topic: 'Trees',
  },
  ...overrides,
});

const createHistory = (
  items: RevisionHistoryItem[],
  overrides: Partial<PaginatedHistory['pagination']> = {}
): PaginatedHistory => ({
  items,
  pagination: {
    page: 1,
    limit: 20,
    total: items.length,
    totalPages: Math.max(1, Math.ceil(items.length / 20)),
    ...overrides,
  },
});

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/reviews/history']}>
      <Routes>
        <Route path="/reviews/history" element={<ReviewHistoryPage />} />
        <Route path="/review" element={<div>Review queue destination</div>} />
        <Route path="/problems/:id" element={<div>Problem detail destination</div>} />
      </Routes>
    </MemoryRouter>
  );

describe('ReviewHistoryPage (Phase 10)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows a labelled loading state while the history is in flight', () => {
    vi.mocked(reviewsApi.fetchUserReviewHistory).mockReturnValue(new Promise(() => {}));

    renderPage();

    expect(screen.getByText('Loading review history')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
  });

  it('renders the logged review with problem context, outcome and progression', async () => {
    vi.mocked(reviewsApi.fetchUserReviewHistory).mockResolvedValue(
      createHistory([createHistoryItem()], { total: 1 })
    );

    renderPage();

    const problemLink = await screen.findByRole('link', { name: /Invert Binary Tree/ });
    expect(problemLink).toHaveAttribute('href', '/problems/prob-1');

    expect(screen.getByText('#7')).toBeInTheDocument();
    expect(screen.getByText('PERSONAL')).toBeInTheDocument();
    expect(screen.getByText('Easy')).toBeInTheDocument();
    expect(screen.getByText('Trees')).toBeInTheDocument();

    expect(screen.getByText('EASY')).toBeInTheDocument();
    expect(screen.getByText('Late by 2 days')).toBeInTheDocument();
    expect(screen.getByText('Cold solve')).toBeInTheDocument();

    // Dates are calendar days, not relative timestamps.
    expect(screen.getByText('Oct 12, 2026')).toBeInTheDocument();
    expect(screen.getByText('Oct 10, 2026')).toBeInTheDocument();

    expect(screen.getByText('Stage 1 (3d)')).toBeInTheDocument();
    expect(screen.getByText('Stage 2 (7d)')).toBeInTheDocument();
    expect(screen.getByText(/Learning → Familiar/)).toBeInTheDocument();

    // 320 seconds is reported in minutes/seconds, never as raw seconds.
    expect(screen.getByText('5m 20s')).toBeInTheDocument();
    expect(screen.queryByText('320')).not.toBeInTheDocument();

    const summary = screen.getByText(/Showing/);
    expect(summary.textContent?.replace(/\s+/g, ' ')).toContain('1–1 of 1');
    expect(screen.getByText('Newest first')).toBeInTheDocument();
  });

  it('renders the empty state with a working Review Queue action', async () => {
    const user = userEvent.setup();
    vi.mocked(reviewsApi.fetchUserReviewHistory).mockResolvedValue(createHistory([], { total: 0 }));

    renderPage();

    expect(await screen.findByText('No reviews completed yet')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /go to review queue/i }));

    expect(await screen.findByText('Review queue destination')).toBeInTheDocument();
  });

  it('shows the failure state and recovers through Retry', async () => {
    const user = userEvent.setup();
    vi.mocked(reviewsApi.fetchUserReviewHistory)
      .mockRejectedValueOnce(new Error('History service unavailable'))
      .mockResolvedValueOnce(createHistory([createHistoryItem()], { total: 1 }));

    renderPage();

    expect(await screen.findByText('History service unavailable')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /try again/i }));

    expect(await screen.findByRole('link', { name: /Invert Binary Tree/ })).toBeInTheDocument();
    expect(reviewsApi.fetchUserReviewHistory).toHaveBeenLastCalledWith(1, 20);
  });

  it('pages forward and backward with the same page size', async () => {
    const user = userEvent.setup();
    const firstPage = Array.from({ length: 20 }, (_, index) =>
      createHistoryItem({
        id: `rev-a-${index}`,
        problem: {
          id: `prob-a-${index}`,
          title: `First page problem ${index + 1}`,
          sNo: index + 1,
          section: 'COLLEGE',
          difficulty: 'Medium',
        },
      })
    );
    const secondPage = [
      createHistoryItem({
        id: 'rev-b-1',
        problem: {
          id: 'prob-b-1',
          title: 'Second page problem',
          sNo: 21,
          section: 'PERSONAL',
          difficulty: 'Hard',
        },
      }),
    ];

    vi.mocked(reviewsApi.fetchUserReviewHistory)
      .mockResolvedValueOnce(createHistory(firstPage, { page: 1, total: 21, totalPages: 2 }))
      .mockResolvedValueOnce(createHistory(secondPage, { page: 2, total: 21, totalPages: 2 }));

    renderPage();

    expect(await screen.findByText('First page problem 1')).toBeInTheDocument();

    const previous = screen.getByRole('button', { name: /previous/i });
    expect(previous).toBeDisabled();
    expect(screen.getByText(/Page 1 of 2/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /next/i }));

    expect(await screen.findByText('Second page problem')).toBeInTheDocument();
    expect(reviewsApi.fetchUserReviewHistory).toHaveBeenLastCalledWith(2, 20);
    expect(screen.getByText(/Page 2 of 2/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: /previous/i }));
    await waitFor(() => {
      expect(reviewsApi.fetchUserReviewHistory).toHaveBeenLastCalledWith(1, 20);
    });
  });

  it('skips entries whose problem no longer exists instead of rendering a dead link', async () => {
    const orphaned = createHistoryItem({
      id: 'rev-orphan',
      problem: undefined,
      problemId: 'deleted-problem-id',
    });

    vi.mocked(reviewsApi.fetchUserReviewHistory).mockResolvedValue(
      createHistory([orphaned], { total: 1 })
    );

    renderPage();

    expect(await screen.findByText('No reviews on this page')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByText('deleted-problem-id')).not.toBeInTheDocument();
  });

  it('does not render pagination for a single page', async () => {
    vi.mocked(reviewsApi.fetchUserReviewHistory).mockResolvedValue(
      createHistory([createHistoryItem()], { total: 1 })
    );

    renderPage();

    await screen.findByRole('link', { name: /Invert Binary Tree/ });
    expect(
      screen.queryByRole('navigation', { name: /review history pagination/i })
    ).not.toBeInTheDocument();
  });
});
