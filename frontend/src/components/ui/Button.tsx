import React, { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { cx } from './cx';
import styles from './Button.module.css';

/**
 * DSA Tracker — UI primitive layer (Phase 2)
 * =========================================
 * `Button` — the single button primitive. There is deliberately no second button
 * implementation: variants and sizes cover every control the redesign needs.
 *
 * Accessibility
 *   - renders a real `<button>` (never a div with a click handler);
 *   - `loading` sets `disabled` + `aria-busy`, and the state is conveyed by the
 *     spinner and an optional `loadingLabel`, never by colour alone;
 *   - keyboard focus uses the tokenised `--focus-ring`;
 *   - `iconOnly` requires an accessible name — pass `aria-label`.
 *
 * Geometry
 *   - `sm` 32px · `md` 38px · `lg` 44px
 *   - 38px is derived from `--control-height-md` (40px) because no 38px token exists.
 *   - on coarse pointers `sm`/`md` expand their hit area to `--layout-touch-target`
 *     (44px) without changing their visual height.
 */

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'subtle';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner and blocks interaction while keeping the label width stable. */
  loading?: boolean;
  /** Label shown while `loading`; falls back to `children`. */
  loadingLabel?: React.ReactNode;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
  /** Square icon-only control. Requires `aria-label`. */
  iconOnly?: boolean;
  fullWidth?: boolean;
}

const SPINNER_SIZE: Record<ButtonSize, number> = { sm: 14, md: 16, lg: 18 };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    loadingLabel,
    iconLeft,
    iconRight,
    iconOnly = false,
    fullWidth = false,
    disabled = false,
    className,
    children,
    type = 'button',
    ...rest
  },
  ref
) {
  const isDisabled = disabled || loading;
  const label = loading && loadingLabel !== undefined ? loadingLabel : children;

  return (
    <button
      {...rest}
      ref={ref}
      type={type}
      className={cx(
        styles.button,
        styles[variant],
        styles[size],
        iconOnly && styles.iconOnly,
        fullWidth && styles.fullWidth,
        className
      )}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      aria-disabled={isDisabled || undefined}
      data-loading={loading ? 'true' : undefined}
    >
      {loading ? (
        <Loader2 className={styles.spinner} size={SPINNER_SIZE[size]} aria-hidden="true" />
      ) : iconLeft ? (
        <span className={styles.icon} aria-hidden="true">
          {iconLeft}
        </span>
      ) : null}

      {label !== undefined && label !== null && label !== false && label !== '' ? (
        <span className={styles.label}>{label}</span>
      ) : loading ? (
        <span className="sr-only">Loading</span>
      ) : null}

      {!loading && iconRight ? (
        <span className={styles.icon} aria-hidden="true">
          {iconRight}
        </span>
      ) : null}
    </button>
  );
});
