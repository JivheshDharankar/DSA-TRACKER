import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RecallSessionModal } from '../../src/components/reviews/RecallSessionModal';
import { createMockProblem } from '../fixtures/problem.fixture';
import * as reviewsApi from '../../src/api/reviews.api';
import { ReviewSubmissionResult } from '../../src/types';

vi.mock('../../src/api/reviews.api', () => ({
  submitReview: vi.fn(),
}));

describe('RecallSessionModal component', () => {
  const mockProblem = createMockProblem({
    id: 'prob-rev-1',
    sNo: 7,
    title: 'Invert Binary Tree',
    topic: 'Trees',
    notes: 'Recursively swap left and right subtrees.',
    repetitionStage: 1,
    intervalDays: 1,
    retentionLevel: 'Learning',
  });

  const mockSubmissionResult: ReviewSubmissionResult = {
    problem: mockProblem,
    history: {
      id: 'rev-hist-1',
      userId: 'user-1',
      problemId: 'prob-rev-1',
      reviewedAt: '2026-09-20T12:00:00.000Z',
      scheduledReviewAt: '2026-09-20T00:00:00.000Z',
      recallResult: 'EASY',
      timingStatus: 'ON_TIME',
      latenessDays: 0,
      previousStage: 1,
      newStage: 2,
      previousIntervalDays: 1,
      newIntervalDays: 3,
      previousRetention: 'Learning',
      newRetention: 'Familiar',
      previousNextReviewDate: '2026-09-20T00:00:00.000Z',
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
      scheduledReviewAt: '2026-09-20T00:00:00.000Z',
      reviewedAt: '2026-09-20T12:00:00.000Z',
      timingStatus: 'ON_TIME',
      latenessDays: 0,
      nextReviewDate: '2026-09-23T00:00:00.000Z',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(reviewsApi.submitReview).mockResolvedValue(mockSubmissionResult);
  });

  it('renders nothing when isOpen is false or problem is null', () => {
    const { container: c1 } = render(
      <RecallSessionModal
        isOpen={false}
        problem={mockProblem}
        onClose={() => {}}
        onSuccess={() => {}}
      />
    );
    expect(c1.firstChild).toBeNull();

    const { container: c2 } = render(
      <RecallSessionModal
        isOpen={true}
        problem={null}
        onClose={() => {}}
        onSuccess={() => {}}
      />
    );
    expect(c2.firstChild).toBeNull();
  });

  it('renders attempt step with timer, cold solve toggle, and Finish Attempt button', () => {
    render(
      <RecallSessionModal
        isOpen={true}
        problem={mockProblem}
        onClose={() => {}}
        onSuccess={() => {}}
      />
    );

    expect(screen.getByText(/Invert Binary Tree/i)).toBeInTheDocument();
    expect(screen.getByText(/COLLEGE DSA #7/i)).toBeInTheDocument();
    expect(screen.getByText("I've Finished My Attempt")).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Cold solve attempt/i })).toBeChecked();
  });

  it('advances from ATTEMPT to EVALUATE step when clicking Finish Attempt', async () => {
    const user = userEvent.setup();

    render(
      <RecallSessionModal
        isOpen={true}
        problem={mockProblem}
        onClose={() => {}}
        onSuccess={() => {}}
      />
    );

    await user.click(screen.getByText("I've Finished My Attempt"));

    expect(screen.getByText('Evaluate your recall quality:')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reveal Solution Notes/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /EASY/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /STRUGGLED/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /HINT/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /FORGOT/i })).toBeInTheDocument();
  });

  it('toggles notes visibility when clicking Reveal/Hide Solution Notes', async () => {
    const user = userEvent.setup();

    render(
      <RecallSessionModal
        isOpen={true}
        problem={mockProblem}
        onClose={() => {}}
        onSuccess={() => {}}
      />
    );

    await user.click(screen.getByText("I've Finished My Attempt"));

    // Notes hidden initially
    expect(screen.queryByText('Recursively swap left and right subtrees.')).not.toBeInTheDocument();

    // Reveal notes
    await user.click(screen.getByRole('button', { name: /Reveal Solution Notes/i }));
    expect(screen.getByText('Recursively swap left and right subtrees.')).toBeInTheDocument();

    // Hide notes
    await user.click(screen.getByRole('button', { name: /Hide Notes/i }));
    expect(screen.queryByText('Recursively swap left and right subtrees.')).not.toBeInTheDocument();
  });

  it('submits review rating to API and advances to RESULT step displaying progression', async () => {
    const user = userEvent.setup();
    const handleSuccess = vi.fn();

    render(
      <RecallSessionModal
        isOpen={true}
        problem={mockProblem}
        onClose={() => {}}
        onSuccess={handleSuccess}
      />
    );

    // Finish attempt
    await user.click(screen.getByText("I've Finished My Attempt"));

    // Select EASY
    await user.click(screen.getByRole('button', { name: /EASY/i }));

    expect(reviewsApi.submitReview).toHaveBeenCalledWith(
      expect.objectContaining({
        problemId: 'prob-rev-1',
        recallResult: 'EASY',
        coldSolve: true,
      })
    );

    await waitFor(() => {
      expect(screen.getByText('Revision Recorded!')).toBeInTheDocument();
    });

    // Scoped to the result panel: the SRS stepper above it also announces stage numbers
    // ("Stage 1: Day 1 … — Completed") for assistive technology.
    const resultPanel = screen.getByRole('status');
    expect(within(resultPanel).getByText(/Stage 1/i)).toBeInTheDocument();
    expect(within(resultPanel).getByText(/Stage 2/i)).toBeInTheDocument();
    expect(within(resultPanel).getByText(/Learning → Familiar/i)).toBeInTheDocument();
    expect(handleSuccess).toHaveBeenCalledWith(mockSubmissionResult);
  });

  it('displays error banner when submitReview fails', async () => {
    const user = userEvent.setup();
    vi.mocked(reviewsApi.submitReview).mockRejectedValue(new Error('Network failure recording review'));

    render(
      <RecallSessionModal
        isOpen={true}
        problem={mockProblem}
        onClose={() => {}}
        onSuccess={() => {}}
      />
    );

    await user.click(screen.getByText("I've Finished My Attempt"));
    await user.click(screen.getByRole('button', { name: /STRUGGLED/i }));

    await waitFor(() => {
      expect(screen.getByText('Network failure recording review')).toBeInTheDocument();
    });
  });

  it('calls onClose when the dialog close button is clicked', async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();

    render(
      <RecallSessionModal
        isOpen={true}
        problem={mockProblem}
        onClose={handleClose}
        onSuccess={() => {}}
      />
    );

    await user.click(screen.getByRole('button', { name: /close dialog/i }));
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  /**
   * The overlay itself is now the shared `Dialog` primitive. These assertions cover the
   * contract the migration had to gain: a real modal dialog in a portal, labelled by the
   * problem title, closable with Escape, and with focus moved into it on open.
   *
   * jsdom has no layout, so `useFocusTrap` cannot enumerate focusable descendants
   * (`getClientRects()` is always empty) and Tab cycling therefore cannot be exercised
   * here — that is verified in the browser instead.
   */
  describe('dialog semantics', () => {
    it('renders a modal dialog labelled by the problem title', () => {
      render(
        <RecallSessionModal
          isOpen={true}
          problem={mockProblem}
          onClose={() => {}}
          onSuccess={() => {}}
        />
      );

      const dialog = screen.getByRole('dialog', { name: /Invert Binary Tree/i });
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAccessibleDescription(/COLLEGE DSA #7/i);
    });

    it('moves focus inside the dialog when it opens', () => {
      render(
        <RecallSessionModal
          isOpen={true}
          problem={mockProblem}
          onClose={() => {}}
          onSuccess={() => {}}
        />
      );

      expect(screen.getByRole('dialog')).toContainElement(
        document.activeElement as HTMLElement
      );
    });

    it('closes on Escape', async () => {
      const user = userEvent.setup();
      const handleClose = vi.fn();

      render(
        <RecallSessionModal
          isOpen={true}
          problem={mockProblem}
          onClose={handleClose}
          onSuccess={() => {}}
        />
      );

      await user.keyboard('{Escape}');
      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('locks page scrolling while open and restores it on close', () => {
      const { rerender, unmount } = render(
        <RecallSessionModal
          isOpen={true}
          problem={mockProblem}
          onClose={() => {}}
          onSuccess={() => {}}
        />
      );

      expect(document.body.style.overflow).toBe('hidden');

      rerender(
        <RecallSessionModal
          isOpen={false}
          problem={mockProblem}
          onClose={() => {}}
          onSuccess={() => {}}
        />
      );

      expect(document.body.style.overflow).toBe('');
      unmount();
    });
  });
});
