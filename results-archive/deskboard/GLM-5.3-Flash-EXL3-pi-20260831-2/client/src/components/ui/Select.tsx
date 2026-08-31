import { SelectHTMLAttributes, useId } from 'react';
import { cx } from '../../lib/cx';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  /** Inline validation message rendered below the select. */
  error?: string | null;
  /** Static helper text shown below the control (e.g. why it is locked). */
  hint?: string;
  children: React.ReactNode;
}

/** Select input with a visible, programmatically-tied label and an error slot. */
export function Select({ label, error, hint, className, id, children, ...rest }: SelectProps) {
  const autoId = useId();
  const selectId = id ?? autoId;
  return (
    <div className={cx('field', className)}>
      <label className="field-label" htmlFor={selectId}>
        {label}
      </label>
      <select
        id={selectId}
        className={cx('field-input', 'field-select', error && 'field-input-invalid')}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${selectId}-error` : undefined}
        {...rest}
      >
        {children}
      </select>
      {hint && !error && (
        <p className="field-hint" id={`${selectId}-hint`}>
          {hint}
        </p>
      )}
      {error && (
        <p className="field-error" id={`${selectId}-error`} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
