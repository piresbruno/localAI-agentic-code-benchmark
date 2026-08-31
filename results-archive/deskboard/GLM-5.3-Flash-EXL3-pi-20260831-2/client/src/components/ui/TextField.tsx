import { InputHTMLAttributes, useId } from 'react';
import { cx } from '../../lib/cx';

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  /** Inline validation message rendered below the input. */
  error?: string | null;
}

/** Text input with a visible, programmatically-tied label and an error slot. */
export function TextField({ label, error, className, id, ...rest }: TextFieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <div className={cx('field', className)}>
      <label className="field-label" htmlFor={inputId}>
        {label}
      </label>
      <input
        id={inputId}
        className={cx('field-input', error && 'field-input-invalid')}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${inputId}-error` : undefined}
        {...rest}
      />
      {error && (
        <p className="field-error" id={`${inputId}-error`} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
