import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { RecallSessionModal } from '../../src/components/reviews/RecallSessionModal';
import { createMockProblem } from '../fixtures/problem.fixture';
import * as reviewsApi from '../../src/api/reviews.api';
import type { ReviewSubmissionResult } from '../../src/types';

/**
 * The revision timer, exercised through the real recall dialog.
 *
 * A controlled monotonic clock replaces real waiting, so 60 "seconds" take microseconds.
 * These cover the user-visible contract: the displayed time and the submitted
 * `timeSpentSeconds` both come from real elapsed time, paused (evaluate) time is excluded,
 * and background-tab catch-up works.
 */

vi.mock('../../src/api/reviews.api', () => ({ submitReview: vi.fn() }));

let clockMs = 0;

const problem = createMockProblem({
  id: 'timer-prob-1',
  sNo: 3,
  title: 'Invert Binary Tree',
  topic: 'Trees',
  notes: 'Swap children recursively.',
});

const submission: ReviewSubmissionResult = {
  problem,
  history: {
    id: 'hist-1',
    userId: 'user-1',
    problemId: problem.id,
    reviewedAt: '2026-10-20T12:00:00.000Z',
    scheduledReviewAt: '2026-10-20T00:00:00.000Z',
    recallResult: 'EASY',
    timingStatus: 'ON_TIME',
    latenessDays: 0,
    previousStage: 0,
    newStage: 1,
    previousIntervalDays: 0,
    newIntervalDays: 1,
    previousRetention: 'Learning',
    newRetention: 'Learning',
    previousNextReviewDate: '2026-10-20T00:00:00.000Z',
    newNextReviewDate: '2026-10-21T00:00:00.000Z',
    createdAt: '2026-10-20T12:00:00.000Z',
  },
  transition: {
    previousStage: 0,
    newStage: 1,
    previousIntervalDays: 0,
    newIntervalDays: 1,
    previousRetention: 'Learning',
    newRetention: 'Learning',
    scheduledReviewAt: '2026-10-20T00:00:00.000Z',
    reviewedAt: '2026-10-20T12:00:00.000Z',
    timingStatus: 'ON_TIME',
    latenessDays: 0,
    nextReviewDate: '2026-10-21T00:00:00.000Z',
  },
};

const timerLabel = () => screen.getByRole('timer').getAttribute('aria-label');

/** Advance the fake monotonic clock and let the presentation interval refresh. */
const advanceClock = async (ms: number) => {
  clockMs += ms;
  await act(async () => {
    vi.advanceTimersByTime(250);
  });
};

/** Click and flush the resulting React updates / API microtasks. */
const click = async (element: HTMLElement) => {
  fireEvent.click(element);
  await act(async () => {});
};

const finishAttempt = () => click(screen.getByText("I've Finished My Attempt"));
const chooseRecall = (label: RegExp) => click(screen.getByRole('button', { name: label }));

const renderModal = (onClose = () => {}) =>
  render(<RecallSessionModal isOpen problem={problem} onClose={onClose} onSuccess={() => {}} />);

describe('RecallSessionModal — elapsed timer', () => {
  beforeEach(() => {
    clockMs = 0;
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] });
    vi.spyOn(performance, 'now').mockImplementation(() => clockMs);
    vi.mocked(reviewsApi.submitReview).mockReset();
    vi.mocked(reviewsApi.submitReview).mockResolvedValue(submission);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('shows 01:00 after 60 s and submits 60 s when the attempt is finished', async () => {
    renderModal();

    await advanceClock(60_000);
    expect(timerLabel()).toBe('Elapsed time 01:00');

    await finishAttempt();

    // Evaluate step: the attempt timer is gone (clock paused), so real time passing
    // must not be counted.
    expect(screen.queryByRole('timer')).not.toBeInTheDocument();
    await advanceClock(30_000);
    await chooseRecall(/EASY/i);

    expect(reviewsApi.submitReview).toHaveBeenCalledWith(
      expect.objectContaining({ problemId: problem.id, timeSpentSeconds: 60 })
    );
  });

  it('catches up after a backgrounded tab instead of falling behind', async () => {
    renderModal();

    // Two minutes pass while the tab is hidden and no interval callback runs.
    clockMs += 125_000;
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(timerLabel()).toBe('Elapsed time 02:05');

    await finishAttempt();
    await chooseRecall(/HINT/i);

    expect(reviewsApi.submitReview).toHaveBeenCalledWith(
      expect.objectContaining({ timeSpentSeconds: 125 })
    );
  });

  it('keeps the duration when the dialog rerenders mid-session', async () => {
    const { rerender } = renderModal();

    await advanceClock(30_000);
    rerender(<RecallSessionModal isOpen problem={problem} onClose={() => {}} onSuccess={() => {}} />);
    rerender(<RecallSessionModal isOpen problem={problem} onClose={() => {}} onSuccess={() => {}} />);

    expect(timerLabel()).toBe('Elapsed time 00:30');

    await advanceClock(30_000);
    expect(timerLabel()).toBe('Elapsed time 01:00');

    await finishAttempt();
    await chooseRecall(/STRUGGLED/i);

    expect(reviewsApi.submitReview).toHaveBeenCalledWith(
      expect.objectContaining({ timeSpentSeconds: 60 })
    );
  });

  it('submits 0 s for a very short session and never a negative duration', async () => {
    renderModal();

    expect(timerLabel()).toBe('Elapsed time 00:00');

    await finishAttempt();
    await chooseRecall(/EASY/i);

    expect(reviewsApi.submitReview).toHaveBeenCalledWith(
      expect.objectContaining({ timeSpentSeconds: 0 })
    );
  });

  it('stops counting once the attempt is finished (no duplicate timer keeps running)', async () => {
    renderModal();

    await advanceClock(45_000);
    await finishAttempt();

    // Reveal notes and wait a long time in the evaluate step: the attempt timer is gone,
    // so no second timer can keep counting.
    await click(screen.getByRole('button', { name: /Reveal Solution Notes/i }));
    await advanceClock(120_000);
    expect(screen.queryByRole('timer')).not.toBeInTheDocument();

    await chooseRecall(/FORGOT/i);
    expect(reviewsApi.submitReview).toHaveBeenCalledWith(
      expect.objectContaining({ timeSpentSeconds: 45 })
    );
  });

  it('resets to zero for the next problem in the same dialog', async () => {
    const { rerender } = renderModal();

    await advanceClock(20_000);
    expect(timerLabel()).toBe('Elapsed time 00:20');

    const nextProblem = createMockProblem({ id: 'timer-prob-2', sNo: 4, title: 'Two Sum' });
    rerender(
      <RecallSessionModal isOpen problem={nextProblem} onClose={() => {}} onSuccess={() => {}} />
    );

    expect(timerLabel()).toBe('Elapsed time 00:00');

    await advanceClock(5_000);
    expect(timerLabel()).toBe('Elapsed time 00:05');

    await finishAttempt();
    await chooseRecall(/EASY/i);

    expect(reviewsApi.submitReview).toHaveBeenCalledWith(
      expect.objectContaining({ problemId: 'timer-prob-2', timeSpentSeconds: 5 })
    );
  });
});
