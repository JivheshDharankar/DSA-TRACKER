import React, { forwardRef } from 'react';
import { cx } from './cx';
import { Field, useFieldControl } from './Field';
import styles from './Input.module.css';

/**
 * DSA Tracker — UI primitive layer (Phase 2)
 * =========================================
 * `Input` — a native `<input>` with the shared Field wiring.
 *
 * Two ways to use it, both supported:
 *   <Input label="Title" hint="…" error={error} value={v} onChange={} required />
 *   <Field label="Title"><Input value={v} onChange={} /></Field>
 *
 * Accessibility
 *   - label is associated through `htmlFor` / `id`;
 *   - `aria-invalid` and `aria-describedby` are wired from the Field context;
 *   - 16px text below the `sm` breakpoint (640px) so iOS does not zoom on focus.
 */

export type InputSize = 'default' | 'compact';

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  /** `default` 40px · `compact` 36px. */
  size?: InputSize;
}

type ControlProps = Omit<InputProps, 'label' | 'hint' | 'error'>;

const InputControl = forwardRef<HTMLInputElement, ControlProps>(function InputControl(
  { size = 'default', className, required, disabled, ...rest },
  ref
) {
  const field = useFieldControl();

  const describedBy =
    [field?.describedBy, rest['aria-describedby']].filter((value) => typeof value === 'string' && value).join(' ') ||
    undefined;
  const invalid = rest['aria-invalid'] ?? (field?.invalid || undefined);

  return (
    <input
      {...rest}
      ref={ref}
      id={rest.id ?? field?.id}
      className={cx(styles.control, styles[size], field?.invalid && styles.invalid, className)}
      required={required ?? field?.required}
      disabled={disabled ?? field?.disabled}
      aria-invalid={invalid}
      aria-describedby={describedBy}
    />
  );
});

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, id, required, disabled, ...rest },
  ref
) {
  const control = <InputControl {...rest} id={id} required={required} disabled={disabled} ref={ref} />;

  if (label === undefined && hint === undefined && error === undefined) {
    return control;
  }

  return (
    <Field id={id} label={label} hint={hint} error={error} required={required} disabled={disabled}>
      {control}
    </Field>
  );
});
