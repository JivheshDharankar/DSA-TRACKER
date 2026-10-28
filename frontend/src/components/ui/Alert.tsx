import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { cx } from './cx';
import styles from './Alert.module.css';

/**
 * DSA Tracker — UI primitive layer (Phase 2)
 * =========================================
 * `Alert` — the inline banner used for form-level errors, inline warnings and
 * success confirmations.
 *
 * Accessibility
 *   - `danger` and `warning` announce with `role="alert"`;
 *     `info` and `success` use `role="status"` so nothing is shouted unnecessarily;
 *   - the tone is carried by the icon, not by colour alone, and the text stays on
 *     `--color-text-primary` / `--color-text-secondary` so every tone passes AA;
 *   - the dismiss control is a real button with an `aria-label`.
 *
 * Full-page / section errors are `ErrorState`; field-level errors are `Field`.
 */

export type AlertTone = 'info' | 'success' | 'warning' | 'danger';

export interface AlertProps {
  tone?: AlertTone;
  title?: React.ReactNode;
  children?: React.ReactNode;
  /** Override the tone icon. Pass `null` to render without an icon. */
  icon?: React.ReactNode;
  /** Trailing action slot, e.g. a retry `<Button>`. */
  action?: React.ReactNode;
  /** Renders a dismiss control when provided. */
  onDismiss?: () => void;
  /** Accessible name for the dismiss control. */
  dismissLabel?: string;
  className?: string;
}

const TONE_ICON_SIZE = 18;

export const Alert: React.FC<AlertProps> = ({
  tone = 'info',
  title,
  children,
  icon,
  action,
  onDismiss,
  dismissLabel = 'Dismiss',
  className,
}) => {
  const role = tone === 'danger' || tone === 'warning' ? 'alert' : 'status';

  const defaultIcon =
    tone === 'danger' ? (
      <AlertCircle size={TONE_ICON_SIZE} />
    ) : tone === 'warning' ? (
      <AlertTriangle size={TONE_ICON_SIZE} />
    ) : tone === 'success' ? (
      <CheckCircle2 size={TONE_ICON_SIZE} />
    ) : (
      <Info size={TONE_ICON_SIZE} />
    );

  return (
    <div className={cx(styles.alert, styles[tone], className)} role={role}>
      {icon === null ? null : <span className={styles.icon}>{icon ?? defaultIcon}</span>}

      <div className={styles.content}>
        {title ? <p className={styles.title}>{title}</p> : null}
        {children ? <div className={styles.body}>{children}</div> : null}
      </div>

      {action ? <div className={styles.action}>{action}</div> : null}

      {onDismiss ? (
        <button type="button" className={styles.dismiss} onClick={onDismiss} aria-label={dismissLabel}>
          <X size={16} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
};
