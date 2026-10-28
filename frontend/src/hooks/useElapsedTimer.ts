import { useEffect, useRef, useState } from 'react';

/**
 * DSA Tracker — elapsed-time timer for a revision attempt
 * =======================================================
 * Why this exists
 * ---------------
 * The recall session used to measure time with
 * `setInterval(() => setSecondsElapsed(prev => prev + 1), 1000)`. That counts *ticks*, not
 * time: every late tick still added exactly 1 s, and a tick that never ran was never
 * recovered. Browsers clamp/throttle timers in background tabs (and under load), so the
 * displayed — and submitted — duration fell behind wall-clock time. The faster the machine
 * was busy, the slower the revision appeared to be.
 *
 * How it works now
 * ----------------
 * Elapsed time is derived from a monotonic timestamp, never from tick counts:
 *
 *   accumulatedBeforeSegment + (performance.now() - segmentStartedAt)
 *
 * `setInterval` only refreshes the rendered value; if it fires late, or not at all for a
 * while, the next read still computes the full elapsed time. Pausing commits the finished
 * segment into `accumulated` and clears the start timestamp, so paused time is not counted.
 *
 * Background tabs / minimised windows stay correct because `performance.now()` keeps
 * advancing while the page is hidden; the `visibilitychange` listener refreshes the
 * display the moment the tab becomes visible again instead of waiting for a throttled tick.
 *
 * `resetKey` starts a fresh measurement (a new problem/session). It is compared by value,
 * so passing a new string per session is enough.
 */

/** Presentation refresh only — it has no effect on the measured duration. */
export const ELAPSED_TIMER_REFRESH_MS = 250;

/** Monotonic clock; falls back to `Date.now()` only in environments without `performance`. */
const monotonicNow = (): number =>
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();

export interface UseElapsedTimerOptions {
  /** Whether the clock should be advancing (attempt in progress and modal open). */
  active: boolean;
  /** Changing this value restarts the measurement at zero. */
  resetKey: string;
}

export interface ElapsedTimerState {
  elapsedMs: number;
  /** Whole seconds — the display value and the value submitted with the review. */
  elapsedSeconds: number;
}

export const useElapsedTimer = ({ active, resetKey }: UseElapsedTimerOptions): ElapsedTimerState => {
  const [elapsedMs, setElapsedMs] = useState(0);
  const accumulatedMsRef = useRef(0);
  const segmentStartedAtRef = useRef<number | null>(null);

  // A new session starts from zero. If it is already running, the segment restarts now.
  useEffect(() => {
    accumulatedMsRef.current = 0;
    segmentStartedAtRef.current = active ? monotonicNow() : null;
    setElapsedMs(0);
    // `active` is intentionally not a dependency here: the effect below owns the
    // start/stop edges, and this effect only starts a fresh measurement.
  }, [resetKey]);

  useEffect(() => {
    const commitSegment = () => {
      const startedAt = segmentStartedAtRef.current;
      if (startedAt === null) return;
      accumulatedMsRef.current += Math.max(0, monotonicNow() - startedAt);
      segmentStartedAtRef.current = null;
    };

    if (!active) {
      // Pause: fold the running segment into the total and stop the clock.
      commitSegment();
      setElapsedMs(accumulatedMsRef.current);
      return;
    }

    segmentStartedAtRef.current = monotonicNow();

    const readElapsed = () => {
      const startedAt = segmentStartedAtRef.current;
      if (startedAt === null) return;
      setElapsedMs(accumulatedMsRef.current + Math.max(0, monotonicNow() - startedAt));
    };

    readElapsed();
    const intervalId = window.setInterval(readElapsed, ELAPSED_TIMER_REFRESH_MS);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') readElapsed();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      // Stop/disable/unmount while running: keep the time that really elapsed.
      commitSegment();
    };
  }, [active]);

  return { elapsedMs, elapsedSeconds: Math.floor(elapsedMs / 1000) };
};
