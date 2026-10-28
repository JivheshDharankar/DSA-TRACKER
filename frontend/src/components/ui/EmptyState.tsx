import React from 'react';
import { cx } from './cx';
import styles from './EmptyState.module.css';

/**
 * DSA Tracker — UI primitive layer (Phase 2)
 * =========================================
 * `EmptyState` — the single empty presentation for "no data yet" and "nothing
 * matched", so pages stop inventing their own.
 *
 * The icon and both actions are slots: callers pass a lucide icon and `<Button>`
 * elements, which keeps this file free of page-specific content and keeps action
 * styling consistent with the rest of the system.
 *
 * `compact` suits an inline panel inside a populated page; `full` suits a whole view.
 * The title renders as a heading (`titleAs`, default `h3`) so the region is navigable
 * by heading level.
 */

export type EmptyStateVariant = 'compact' | 'full';

export interface EmptyStateProps {
  /** Visual slot — typically a lucide icon. */
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Primary action slot — typically `<Button>`. */
  primaryAction?: React.ReactNode;
  /** Secondary action slot — typically `<Button variant="ghost">`. */
  secondaryAction?: React.ReactNode;
  variant?: EmptyStateVariant;
  /** Heading level for the title. Default `h3`. */
  titleAs?: 'h2' | 'h3' | 'h4';
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  primaryAction,
  secondaryAction,
  variant = 'full',
  titleAs = 'h3',
  className,
}) => {
  return (
    <div className={cx(styles.root, styles[variant], className)}>
      {icon ? (
        <span className={styles.icon} aria-hidden="true">
          {icon}
        </span>
      ) : null}

      {React.createElement(titleAs, { className: styles.title }, title)}

      {description ? <p className={styles.description}>{description}</p> : null}

      {primaryAction || secondaryAction ? (
        <div className={styles.actions}>
          {primaryAction}
          {secondaryAction}
        </div>
      ) : null}
    </div>
  );
};
