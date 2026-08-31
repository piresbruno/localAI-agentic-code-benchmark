import type { SelectHTMLAttributes } from 'react';

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: SelectOption[];
  error?: string | null;
  disabled?: boolean;
}

/** Select input with a visible label tied via htmlFor and an error message slot. */
export function Select({ label, options, error, id, ...rest }: SelectProps) {
  const fieldId = id ?? `field-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  const errorId = `${fieldId}-error`;
  return (
    <div className="field">
      <label className="field-label" htmlFor={fieldId}>
        {label}
      </label>
      <select
        id={fieldId}
        className={`field-input${error ? ' field-input--invalid' : ''}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        {...rest}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <p className="field-error" id={errorId}>
          {error}
        </p>
      )}
    </div>
  );
}
