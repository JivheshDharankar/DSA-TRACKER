import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { useElapsedTimer } from '../../src/hooks/useElapsedTimer';

/**
 * Regression coverage for the revision timer.
 *
 * The old implementation added 1 second per `setInterval` callback, so any late or skipped
 * tick permanently lost time (background tabs, busy main thread). These tests drive a
 * controlled monotonic clock and assert that elapsed time is read from timestamps: a single
 * late tick, or no tick at all, still reports the full duration.
 */

let clockMs = 0;

const Harness = ({ active, resetKey }: { active: boolean; resetKey: string }) => {
  const { elapsedMs, elapsedSeconds } = useElapsedTimer({ active, resetKey });
  return (
    <output data-testid="timer" data-ms={String(elapsedMs)}>
      {elapsedSeconds}
    </output>
  );
};

const seconds = () => Number(screen.getByTestId('timer').textContent);
const millis = () => Number(screen.getByTestId('timer').getAttribute('data-ms'));

const advanceClock = (ms: number) => {
  clockMs += ms;
};

describe('useElapsedTimer', () => {
  beforeEach(() => {
    clockMs = 0;
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] });
    vi.spyOn(performance, 'now').mockImplementation(() => clockMs);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('reports 60 s after 60 s of real time', () => {
    render(<Harness active resetKey="session-1" />);

    advanceClock(60_000);
    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(seconds()).toBe(60);
    expect(millis()).toBe(60_000);
  });

  it('stays accurate over several minutes and never accumulates drift per tick', () => {
    render(<Harness active resetKey="session-1" />);

    advanceClock(301_400);
    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(seconds()).toBe(301);
  });

  it('does not lose time when a tick fires late (throttled / busy main thread)', () => {
    render(<Harness active resetKey="session-1" />);

    // 90 s pass while no interval callback runs, then a single late refresh happens.
    advanceClock(90_000);
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(seconds()).toBe(90);

    // A second long gap with one tick must also report the full elapsed time.
    advanceClock(30_000);
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(seconds()).toBe(120);
  });

  it('catches up immediately when the tab becomes visible again, without waiting for a tick', () => {
    render(<Harness active resetKey="session-1" />);

    // Background tab: the clock runs but the interval is throttled to nothing.
    advanceClock(185_000);
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(seconds()).toBe(185);
  });

  it('does not reset or change pace across React rerenders', () => {
    const { rerender } = render(<Harness active resetKey="session-1" />);

    advanceClock(10_000);
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(seconds()).toBe(10);

    for (let i = 0; i < 25; i += 1) {
      rerender(<Harness active resetKey="session-1" />);
    }
    expect(seconds()).toBe(10);

    advanceClock(10_000);
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(seconds()).toBe(20);
  });

  it('excludes paused time and resumes from the accumulated value', () => {
    const { rerender } = render(<Harness active resetKey="session-1" />);

    advanceClock(30_000);
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(seconds()).toBe(30);

    // Pause — evaluate step. The clock keeps running in the real world.
    rerender(<Harness active={false} resetKey="session-1" />);
    advanceClock(120_000);
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(seconds()).toBe(30);

    // Resume — only the new active segment is added.
    rerender(<Harness active resetKey="session-1" />);
    advanceClock(15_000);
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(seconds()).toBe(45);
  });

  it('starts at zero when inactive and restarts for a new session key', () => {
    const { rerender } = render(<Harness active={false} resetKey="session-1" />);
    advanceClock(5_000);
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(seconds()).toBe(0);

    rerender(<Harness active resetKey="session-1" />);
    advanceClock(20_000);
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(seconds()).toBe(20);

    // New session: zero, then counts from the new start.
    rerender(<Harness active resetKey="session-2" />);
    expect(seconds()).toBe(0);

    advanceClock(3_000);
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(seconds()).toBe(3);
  });

  it('stops counting if the session is deactivated at a fractional second', () => {
    const { rerender } = render(<Harness active resetKey="session-1" />);

    advanceClock(1_700);
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(millis()).toBe(1_700);
    expect(seconds()).toBe(1);

    rerender(<Harness active={false} resetKey="session-1" />);
    advanceClock(10_000);
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(millis()).toBe(1_700);
    expect(seconds()).toBe(1);
  });
});
