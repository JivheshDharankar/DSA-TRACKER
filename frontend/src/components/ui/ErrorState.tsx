import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { cx } from './cx';
import { Button } from './Button';
import styles from './ErrorState.module.css';

/**
 * DSA Tracker — UI primitive layer (Phase 2)
 * =========================================
 * `ErrorState` — the section / full-page failure presentation, with an optional retry.
 *
 * Announces with `role="alert"` because it renders in place of content the user was
 * waiting for. Inline banners are `Alert`; field errors are `Field`.
 *
 * The retry control is a real `Button`, so loading and disabled behaviour stay
 * consistent with the rest of the system.
 */

export type ErrorStateVariant = 'section' | 'full' | 'compact';

export interface ErrorStateProps {
  /** Defaults to "Something went wrong". */
  title?: React.ReactNode;
  /** The failure message. */
  message: React.ReactNode;
  /** Renders a retry action when provided. */
  onRetry?: () => void;
  /** Label for the retry control. Default "Try again". */
  retryLabel?: string;
  /** Puts the retry control into its loading state. */
  isRetrying?: boolean;
  /** Visual slot; defaults to a warning icon. Pass `null` to omit. */
  icon?: React.ReactNode;
  variant?: ErrorStateVariant;
  className?: string;
  /** Extra actions rendered next to the retry control. */
  actions?: React.ReactNode;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Something went wrong',
  message,
  onRetry,
  retryLabel = 'Try again',
  isRetrying = false,
  icon,
  variant = 'section',
  className,
  actions,
}) => (
  <div className={cx(styles.root, styles[variant], className)} role="alert">
    {icon === null ? null : <span className={styles.icon}>{icon ?? <AlertTriangle size={24} />}</span>}

    <h3 className={styles.title}>{title}</h3>
    <p className={styles.message}>{message}</p>

    {onRetry || actions ? (
      <div className={styles.actions}>
        {onRetry ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={onRetry}
            loading={isRetrying}
            iconLeft={<RotateCcw size={14} />}
          >
            {retryLabel}
          </Button>
        ) : null}
        {actions}
      </div>
    ) : null}
  </div>
);
