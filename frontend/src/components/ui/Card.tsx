import React from 'react';
import { cx } from './cx';
import styles from './Card.module.css';

/**
 * DSA Tracker — UI primitive layer (Phase 2)
 * =========================================
 * `Card` — the standard surface for grouped content.
 *
 * One hairline border, 12px radius, no shadow by default. `raised` adds a lighter
 * surface, a stronger border and the smallest elevation step; `interactive` adds the
 * hover/focus affordance — and only then, so static cards never lift.
 *
 * Intentionally a single component: header/body/footer sub-components are not needed
 * until a screen proves it, and pages compose their own inner layout.
 *
 * Renders a `<div>` — no `as`/forwardRef in this phase. If a later phase needs the
 * surface to be a `<li>` or `<section>`, add it there rather than widening the API now.
 */

export type CardVariant = 'default' | 'raised' | 'compact';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  /** Adds hover/focus affordance. Use only when the whole card is clickable. */
  interactive?: boolean;
  children?: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({ variant = 'default', interactive = false, className, children, ...rest }) => (
  <div className={cx(styles.card, styles[variant], interactive && styles.interactive, className)} {...rest}>
    {children}
  </div>
);
