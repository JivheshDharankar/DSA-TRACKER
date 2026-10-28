import { useEffect } from 'react';

/**
 * Body scroll lock for overlay surfaces (Dialog today, the navigation drawer in a
 * later phase).
 *
 * Uses a module-level counter so nested overlays do not fight each other: only the
 * first lock records the previous value and only the last unlock restores it.
 *
 * Intentionally minimal — it does NOT compensate for the removed scrollbar width,
 * because the app styles its own 8px scrollbars and the compensating padding would
 * shift every existing layout during the migration phases.
 */
let lockCount = 0;
let previousOverflow = '';

export const useScrollLock = (locked: boolean): void => {
  useEffect(() => {
    if (!locked || typeof document === 'undefined') {
      return;
    }

    if (lockCount === 0) {
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    lockCount += 1;

    return () => {
      lockCount = Math.max(0, lockCount - 1);
      if (lockCount === 0) {
        document.body.style.overflow = previousOverflow;
        previousOverflow = '';
      }
    };
  }, [locked]);
};
