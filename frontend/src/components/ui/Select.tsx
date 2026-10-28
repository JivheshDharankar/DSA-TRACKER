import React, { forwardRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { cx } from './cx';
import { Field, useFieldControl } from './Field';
import styles from './Select.module.css';

/**
 * DSA Tracker — UI primitive layer (Phase 2)
 * =========================================
 * `Select` — a **real native `<select>`**.
 *
 * The underlying control is never replaced by a custom listbox: the existing
 * end-to-end suite drives `selectOption()` against native selects, and native
 * selects keep platform keyboard/mobile picker behaviour for free. Only the
 * `appearance` is reset and a decorative chevron is layered behind the options.
 */

export type SelectSize = 'default' | 'compact';

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  /** `default` 40px · `compact` 36px. */
  size?: SelectSize;
  /** Options — normally `<option>` children. */
  children?: React.ReactNode;
}

type ControlProps = Omit<SelectProps, 'label' | 'hint' | 'error'>;

const SelectControl = forwardRef<HTMLSelectElement, ControlProps>(function SelectControl(
  { size = 'default', className, required, disabled, children, ...rest },
  ref
) {
  const field = useFieldControl();

  const describedBy =
    [field?.describedBy, rest['aria-describedby']].filter((value) => typeof value === 'string' && value).join(' ') ||
    undefined;
  const invalid = rest['aria-invalid'] ?? (field?.invalid || undefined);

  return (
    <span className={styles.wrapper}>
      <select
        {...rest}
        ref={ref}
        id={rest.id ?? field?.id}
        className={cx(styles.control, styles[size], field?.invalid && styles.invalid, className)}
        required={required ?? field?.required}
        disabled={disabled ?? field?.disabled}
        aria-invalid={invalid}
        aria-describedby={describedBy}
      >
        {children}
      </select>
      <ChevronDown className={styles.chevron} size={16} aria-hidden="true" />
    </span>
  );
});

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hint, error, id, required, disabled, children, ...rest },
  ref
) {
  const control = (
    <SelectControl {...rest} id={id} required={required} disabled={disabled} ref={ref}>
      {children}
    </SelectControl>
  );

  if (label === undefined && hint === undefined && error === undefined) {
    return control;
  }

  return (
    <Field id={id} label={label} hint={hint} error={error} required={required} disabled={disabled}>
      {control}
    </Field>
  );
});
