import { useId, type ReactNode, type SelectHTMLAttributes } from 'react';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string | null;
  children: ReactNode;
}

/** Labelled select with the same error/disabled contract as TextField. */
export function Select({ label, error, id, children, ...rest }: SelectProps) {
  const autoId = useId();
  const selectId = id ?? autoId;
  return (
    <div className="field">
      <label className="field__label" htmlFor={selectId}>
        {label}
      </label>
      <select
        id={selectId}
        className={`field__input field__select${error ? ' field__input--invalid' : ''}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${selectId}-error` : undefined}
        {...rest}
      >
        {children}
      </select>
      {error && (
        <span className="field__error" id={`${selectId}-error`} role="alert">
          ⚠ {error}
        </span>
      )}
    </div>
  );
}
