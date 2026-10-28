import React from 'react';
import { cx } from './cx';
import styles from './Badge.module.css';

/**
 * DSA Tracker — UI primitive layer (Phase 2)
 * =========================================
 * `Badge` — one small status chip for the whole app, so no page invents its own.
 *
 * The API is intentionally three props wide: `tone`, `shape` and an optional `dot`.
 * Difficulty/retention/mastery chips are built on top of this in the migration
 * phase, using the `--color-difficulty-*` / `--color-retention-*` /
 * `--color-mastery-*` tokens that already exist.
 *
 * Semantics: the tone is carried by the tinted surface and the dot colour; the label
 * itself uses `--color-text-primary`, which keeps every tone at AA contrast even
 * though the token set has no light step for the danger hue.
 */

export type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info';
export type BadgeShape = 'compact' | 'pill';

export interface BadgeProps {
  tone?: BadgeTone;
  /** `compact` 4px radius · `pill` fully rounded. */
  shape?: BadgeShape;
  /** Prefixes a tone-coloured status dot. */
  dot?: boolean;
  className?: string;
  children: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({ tone = 'neutral', shape = 'compact', dot = false, className, children }) => (
  <span className={cx(styles.badge, styles[tone], styles[shape], className)}>
    {dot ? <span className={styles.dot} aria-hidden="true" /> : null}
    {children}
  </span>
);
