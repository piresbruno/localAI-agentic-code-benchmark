import type { InputHTMLAttributes, ReactNode } from 'react';

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  /** Field-level error message shown under the input. */
  error?: string | null;
  hint?: ReactNode;
}

/** Text input with a visible label tied via htmlFor and an error message slot. */
export function TextField({ label, error, hint, id, ...rest }: TextFieldProps) {
  const fieldId = id ?? `field-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  const errorId = `${fieldId}-error`;
  return (
    <div className="field">
      <label className="field-label" htmlFor={fieldId}>
        {label}
      </label>
      <input
        id={fieldId}
        className={`field-input${error ? ' field-input--invalid' : ''}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        {...rest}
      />
      {hint && !error && <p className="muted">{hint}</p>}
      {error && (
        <p className="field-error" id={errorId}>
          {error}
        </p>
      )}
    </div>
  );
}
