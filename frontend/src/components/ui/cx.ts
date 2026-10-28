/**
 * DSA Tracker — UI primitive layer (Phase 2)
 * =========================================
 * Class-name composition helper for the design-system primitives.
 *
 * Kept deliberately tiny and dependency-free (no `clsx`/`classnames` package is
 * installed). Falsy entries are dropped so variant maps can be written inline:
 *
 *   cx(styles.button, styles[variant], iconOnly && styles.iconOnly, className)
 */
export const cx = (
  ...values: ReadonlyArray<string | false | null | undefined>
): string => values.filter((value): value is string => typeof value === 'string' && value.length > 0).join(' ');
