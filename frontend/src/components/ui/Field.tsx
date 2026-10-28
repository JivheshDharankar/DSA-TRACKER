import React, { createContext, useContext, useId, useMemo } from 'react';
import { cx } from './cx';
import styles from './Field.module.css';

/**
 * DSA Tracker — UI primitive layer (Phase 2)
 * =========================================
 * `Field` — the shared label / hint / error shell used by `Input` and `Select`.
 *
 * It exists so the two controls cannot drift apart: both consume `useFieldControl()`
 * for their `id`, `aria-describedby`, `aria-invalid` and `required` wiring, and the
 * error text is announced with `role="alert"`.
 *
 *   <Field label="Title" hint="Used on the tracker" error={error} required>
 *     <Input value={value} onChange={onChange} />
 *   </Field>
 *
 * The hook is optional: a control rendered outside a `Field` simply gets no wiring.
 */

interface FieldControlValue {
  id: string;
  describedBy?: string;
  invalid: boolean;
  required: boolean;
  disabled: boolean;
}

const FieldControlContext = createContext<FieldControlValue | null>(null);

/** Read the surrounding `Field` wiring, or `null` when rendered standalone. */
export const useFieldControl = (): FieldControlValue | null => useContext(FieldControlContext);

export interface FieldProps {
  /** Control label. Omit for a label-less layout wrapper. */
  label?: React.ReactNode;
  /** Supporting text shown below the control while there is no error. */
  hint?: React.ReactNode;
  /** Error text; shown instead of the hint and wired through `aria-describedby`. */
  error?: React.ReactNode;
  /** Marks the control as required and appends a required indicator. */
  required?: boolean;
  /** Disables the control through context. */
  disabled?: boolean;
  /** Explicit id for the control; generated with `useId` when omitted. */
  id?: string;
  className?: string;
  children: React.ReactNode;
}

export const Field: React.FC<FieldProps> = ({
  label,
  hint,
  error,
  required = false,
  disabled = false,
  id,
  className,
  children,
}) => {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const hintId = `${controlId}-hint`;
  const errorId = `${controlId}-error`;
  const hasError = error !== undefined && error !== null && error !== false && error !== '';

  const value = useMemo<FieldControlValue>(
    () => ({
      id: controlId,
      describedBy: hasError ? errorId : hint ? hintId : undefined,
      invalid: hasError,
      required,
      disabled,
    }),
    [controlId, errorId, hintId, hasError, hint, required, disabled]
  );

  return (
    <div className={cx(styles.field, className)}>
      {label !== undefined && label !== null ? (
        <label className={styles.label} htmlFor={controlId}>
          {label}
          {required ? (
            <>
              <span className={styles.requiredMark} aria-hidden="true">
                *
              </span>
              <span className="sr-only"> (required)</span>
            </>
          ) : null}
        </label>
      ) : null}

      <FieldControlContext.Provider value={value}>{children}</FieldControlContext.Provider>

      {hasError ? (
        <p className={styles.error} id={errorId} role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className={styles.hint} id={hintId}>
          {hint}
        </p>
      ) : null}
    </div>
  );
};
