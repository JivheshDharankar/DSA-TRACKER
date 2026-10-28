import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ReviewPage } from '../../src/pages/ReviewPage';
import * as reviewsApi from '../../src/api/reviews.api';
import { createMockProblem } from '../fixtures/problem.fixture';
import { ReviewSubmissionResult } from '../../src/types';

vi.mock('../../src/api/reviews.api', () => ({
  fetchDueReviews: vi.fn(),
  submitReview: vi.fn(),
}));

/**
 * Phase 8 — Review flow behaviour
 * ===============================
 * Covers what the redesign had to preserve and what it added:
 *
 *   - the four render states of the queue, in particular that a failed request can no
 *     longer render the "All Caught Up!" panel underneath its own error banner;
 *   - the section filter (the same `{ section }` query parameter, now announced through
 *     `aria-pressed` instead of colour alone) and its refetch;
 *   - the preserved due wording (`getDueBadgeInfo`, calendar days) and stage/interval text;
 *   - the hand-off into the recall session: the modal opens on the chosen problem, submits
 *     the same payload, reports success back to the queue, and the queue refetches.
 *
 * Layout, breakpoints and pixel values are deliberately not asserted here — jsdom has no
 * layout; those were verified in the browser.
 */

/** Today at UTC midnight — the same calendar day the backend schedules reviews on. */
const todayUtcIso = (): string => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
};

const dueProblem = (overrides: Parameters<typeof createMockProblem>[0] = {}) =>
  createMockProblem({
    nextReviewDate: todayUtcIso(),
    lastReviewedAt: '2026-09-01T00:00:00.000Z',
    repetitionStage: 1,
    intervalDays: 1,
    ...overrides,
  });

const paginated = (items: ReturnType<typeof dueProblem>[]) => ({
  items,
  pagination: { page: 1, limit: 20, total: items.length, totalPages: 1 },
});

const submissionResult = (problemId: string): ReviewSubmissionResult => ({
  problem: dueProblem({ id: problemId }),
  history: {
    id: 'rev-hist-1',
    userId: 'user-1',
    problemId,
    reviewedAt: '2026-09-20T12:00:00.000Z',
    scheduledReviewAt: todayUtcIso(),
    recallResult: 'EASY',
    timingStatus: 'ON_TIME',
    latenessDays: 0,
    previousStage: 1,
    newStage: 2,
    previousIntervalDays: 1,
    newIntervalDays: 3,
    previousRetention: 'Learning',
    newRetention: 'Familiar',
    previousNextReviewDate: todayUtcIso(),
    newNextReviewDate: '2026-09-23T00:00:00.000Z',
    createdAt: '2026-09-20T12:00:00.000Z',
  },
  transition: {
    previousStage: 1,
    newStage: 2,
    previousIntervalDays: 1,
    newIntervalDays: 3,
    previousRetention: 'Learning',
    newRetention: 'Familiar',
    scheduledReviewAt: todayUtcIso(),
    reviewedAt: '2026-09-20T12:00:00.000Z',
    timingStatus: 'ON_TIME',
    latenessDays: 0,
    nextReviewDate: '2026-09-23T00:00:00.000Z',
  },
});

const renderReviewPage = () =>
  render(
    <MemoryRouter initialEntries={['/review']}>
      <Routes>
        <Route path="/review" element={<ReviewPage />} />
        <Route path="/personal-dsa" element={<div>Personal DSA destination</div>} />
        <Route path="/college-dsa" element={<div>College DSA destination</div>} />
        <Route path="/problems/:id" element={<div>Problem detail destination</div>} />
      </Routes>
    </MemoryRouter>
  );

describe('Review flow — due queue and recall session', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(reviewsApi.fetchDueReviews).mockResolvedValue(
      paginated([dueProblem({ id: 'prob-1', sNo: 1, title: 'Two Sum' })])
    );
    vi.mocked(reviewsApi.submitReview).mockResolvedValue(submissionResult('prob-1'));
  });

  it('announces the loading state, then renders the queue with its due count', async () => {
    let resolveDue: (value: ReturnType<typeof paginated>) => void = () => {};
    vi.mocked(reviewsApi.fetchDueReviews).mockReturnValue(
      new Promise((resolve) => {
        resolveDue = resolve;
      })
    );

    renderReviewPage();

    expect(screen.getByRole('status')).toHaveTextContent(/loading due revision queue/i);

    resolveDue(paginated([dueProblem({ id: 'prob-1', sNo: 1, title: 'Two Sum' })]));

    expect(await screen.findByRole('link', { name: 'Two Sum' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Due Revisions' })).toBeInTheDocument();
    expect(screen.getByText('1 Due')).toBeInTheDocument();
    expect(screen.getByText('Due today')).toBeInTheDocument();
    expect(screen.getByText('Stage 1 (1d)')).toBeInTheDocument();
    expect(screen.getByRole('list')).toHaveTextContent('Two Sum');
  });

  it('never renders the empty panel underneath an error, and retries successfully', async () => {
    const user = userEvent.setup();
    vi.mocked(reviewsApi.fetchDueReviews).mockRejectedValueOnce(
      new Error('Failed to fetch due reviews.')
    );

    renderReviewPage();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Failed to fetch due reviews.');
    expect(screen.queryByText('All Caught Up!')).not.toBeInTheDocument();

    vi.mocked(reviewsApi.fetchDueReviews).mockResolvedValueOnce(
      paginated([dueProblem({ id: 'prob-1', sNo: 1, title: 'Two Sum' })])
    );

    await user.click(screen.getByRole('button', { name: /retry/i }));

    expect(await screen.findByRole('link', { name: 'Two Sum' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows the empty state with working links to both trackers when nothing is due', async () => {
    const user = userEvent.setup();
    vi.mocked(reviewsApi.fetchDueReviews).mockResolvedValue(paginated([]));

    renderReviewPage();

    const heading = await screen.findByRole('heading', { name: 'All Caught Up!' });
    // Scoped to the empty panel: the section filter group carries the same two labels.
    const emptyPanel = heading.parentElement as HTMLElement;

    await user.click(within(emptyPanel).getByRole('button', { name: /personal dsa/i }));
    expect(screen.getByText('Personal DSA destination')).toBeInTheDocument();
  });

  it('filters by section through the same query parameter and reports the pressed state', async () => {
    const user = userEvent.setup();
    renderReviewPage();

    await screen.findByRole('link', { name: 'Two Sum' });

    const allSections = screen.getByRole('button', { name: 'All Sections' });
    const college = screen.getByRole('button', { name: 'College DSA' });

    expect(allSections).toHaveAttribute('aria-pressed', 'true');
    expect(college).toHaveAttribute('aria-pressed', 'false');
    expect(reviewsApi.fetchDueReviews).toHaveBeenLastCalledWith({});

    await user.click(college);

    await waitFor(() =>
      expect(reviewsApi.fetchDueReviews).toHaveBeenLastCalledWith({ section: 'COLLEGE' })
    );
    expect(college).toHaveAttribute('aria-pressed', 'true');
    expect(allSections).toHaveAttribute('aria-pressed', 'false');
  });

  it('opens the recall session on the chosen problem and submits the same payload', async () => {
    const user = userEvent.setup();
    renderReviewPage();

    await user.click(await screen.findByRole('button', { name: /start revision/i }));

    const dialog = screen.getByRole('dialog', { name: 'Two Sum' });
    expect(within(dialog).getByText(/COLLEGE DSA #1/)).toBeInTheDocument();
    expect(within(dialog).getByRole('timer')).toBeInTheDocument();
    expect(within(dialog).getByRole('checkbox', { name: /cold solve attempt/i })).toBeChecked();

    await user.click(within(dialog).getByText("I've Finished My Attempt"));
    await user.click(within(dialog).getByRole('button', { name: /EASY/i }));

    expect(reviewsApi.submitReview).toHaveBeenCalledWith({
      problemId: 'prob-1',
      recallResult: 'EASY',
      timeSpentSeconds: expect.any(Number),
      coldSolve: true,
    });

    // The result step stays inside the same dialog and reports the schedule.
    expect(await within(dialog).findByText('Revision Recorded!')).toBeInTheDocument();
    expect(within(dialog).getByText('Sep 23, 2026')).toBeInTheDocument();

    // The queue refetches as soon as the API responds, and the modal closes on request.
    await waitFor(() => expect(reviewsApi.fetchDueReviews).toHaveBeenCalledTimes(2));

    await user.click(within(dialog).getByRole('button', { name: /back to due queue/i }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('keeps the evaluate step open with the error banner when the submit fails', async () => {
    const user = userEvent.setup();
    vi.mocked(reviewsApi.submitReview).mockRejectedValue(new Error('Network failure recording review'));

    renderReviewPage();

    await user.click(await screen.findByRole('button', { name: /start revision/i }));
    await user.click(screen.getByText("I've Finished My Attempt"));
    await user.click(screen.getByRole('button', { name: /STRUGGLED/i }));

    expect(await screen.findByText('Network failure recording review')).toBeInTheDocument();

    // Still on the evaluate step, so the choice can be retried.
    expect(screen.getByText('Evaluate your recall quality:')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /EASY/i })).toBeEnabled();
    // The queue did not refetch on a failed submit.
    expect(reviewsApi.fetchDueReviews).toHaveBeenCalledTimes(1);
  });

  it('closes the recall session on Escape and returns focus to the Start Revision button', async () => {
    const user = userEvent.setup();
    renderReviewPage();

    const startButton = await screen.findByRole('button', { name: /start revision/i });
    await user.click(startButton);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(startButton).toHaveFocus();
  });
});
