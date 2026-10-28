import React from 'react';
import { cx } from './cx';
import styles from './Progress.module.css';

/**
 * DSA Tracker — UI primitive layer (Phase 2)
 * =========================================
 * `Progress` (linear) and `ProgressRing` (radial).
 *
 * Tones resolve to semantic tokens only — no page-level colours are hardcoded, so the
 * same primitive can show review progress (`accent`), mastered problems (`mastery`)
 * or a warning threshold (`warning`).
 *
 * Accessibility: both expose `role="progressbar"` with `aria-valuenow/min/max` and a
 * required accessible name.
 */

export type ProgressTone =
  | 'accent'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'mastery'
  | 'muted';
export type ProgressSize = 'sm' | 'md';
export type ProgressRingSize = 'md' | 'lg';

const clamp = (value: number, max: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(Math.max(value, 0), max);
};

const percentOf = (value: number, max: number): number => {
  const safeMax = max > 0 ? max : 1;
  return Math.round((clamp(value, safeMax) / safeMax) * 100);
};

export interface ProgressProps {
  value: number;
  max?: number;
  /** Accessible name, e.g. "Revision progress". */
  label: string;
  tone?: ProgressTone;
  /** `sm` 4px track · `md` 6px track (default). */
  size?: ProgressSize;
  className?: string;
}

export const Progress: React.FC<ProgressProps> = ({
  value,
  max = 100,
  label,
  tone = 'accent',
  size = 'md',
  className,
}) => {
  const bounded = clamp(value, max > 0 ? max : 1);
  const percent = percentOf(value, max);

  return (
    <div
      className={cx(styles.track, styles[size], className)}
      role="progressbar"
      aria-label={label}
      aria-valuenow={bounded}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuetext={`${percent}%`}
    >
      <div className={cx(styles.bar, styles[tone])} style={{ width: `${percent}%` }} />
    </div>
  );
};

/** Ring geometry — 64px matches `--space-8`; 96px is 1.5× that. SVG viewBox maths
 *  needs numbers, so the values live here rather than in CSS. */
const RING_GEOMETRY: Record<ProgressRingSize, number> = { md: 64, lg: 96 };
const RING_STROKE = 6;

/** Size classes are separate from the linear track's `.sm`/`.md`. */
const RING_SIZE_CLASS: Record<ProgressRingSize, string> = { md: styles.ringMd, lg: styles.ringLg };

export interface ProgressRingProps {
  value: number;
  max?: number;
  /** Accessible name, e.g. "Pattern mastery". */
  label: string;
  /** `md` 64px · `lg` 96px. */
  size?: ProgressRingSize;
  tone?: ProgressTone;
  /** Centre content, e.g. a percentage `<span>`. */
  children?: React.ReactNode;
  className?: string;
}

export const ProgressRing: React.FC<ProgressRingProps> = ({
  value,
  max = 100,
  label,
  size = 'md',
  tone = 'accent',
  children,
  className,
}) => {
  const dimension = RING_GEOMETRY[size];
  const radius = (dimension - RING_STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const safeMax = max > 0 ? max : 1;
  const bounded = clamp(value, safeMax);
  const dash = (bounded / safeMax) * circumference;

  return (
    <div
      className={cx(styles.ring, RING_SIZE_CLASS[size], className)}
      role="progressbar"
      aria-label={label}
      aria-valuenow={bounded}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuetext={`${percentOf(value, max)}%`}
    >
      <svg width={dimension} height={dimension} viewBox={`0 0 ${dimension} ${dimension}`} aria-hidden="true">
        <circle
          className={styles.ringTrack}
          cx={dimension / 2}
          cy={dimension / 2}
          r={radius}
          strokeWidth={RING_STROKE}
        />
        <circle
          className={cx(styles.ringBar, styles[tone])}
          cx={dimension / 2}
          cy={dimension / 2}
          r={radius}
          strokeWidth={RING_STROKE}
          strokeDasharray={`${dash} ${circumference}`}
          transform={`rotate(-90 ${dimension / 2} ${dimension / 2})`}
        />
      </svg>
      {children ? <span className={styles.ringContent}>{children}</span> : null}
    </div>
  );
};
