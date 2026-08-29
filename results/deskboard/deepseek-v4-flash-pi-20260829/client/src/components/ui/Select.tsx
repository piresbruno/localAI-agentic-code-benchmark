import { useId } from 'react';
import type { ReactNode, SelectHTMLAttributes } from 'react';
import './ui.css';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  children: ReactNode;
}

/** Native select with a real label and an error slot. */
export function Select({ label, error, id, className = '', children, ...rest }: SelectProps) {
  const autoId = useId();
  const selectId = id ?? autoId;
  return (
    <div className={`field ${className}`}>
      <label className="field-label" htmlFor={selectId}>
        {label}
      </label>
      <select
        id={selectId}
        className={`field-input ${error ? 'field-input-error' : ''}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${selectId}-error` : undefined}
        {...rest}
      >
        {children}
      </select>
      {error ? (
        <p id={`${selectId}-error`} className="field-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
