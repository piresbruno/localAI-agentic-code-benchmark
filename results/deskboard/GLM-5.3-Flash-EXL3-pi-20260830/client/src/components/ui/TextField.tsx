/** TextField — labeled input with an error message slot. */
export interface TextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string | null;
  hint?: string;
}

export function TextField({ label, error, hint, id, ...rest }: TextFieldProps) {
  const inputId = id ?? `field-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;
  return (
    <div className="field">
      <label className="field__label" htmlFor={inputId}>
        {label}
      </label>
      <input
        id={inputId}
        className={`field__input${error ? ' field__input--error' : ''}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...rest}
      />
      {hint && !error && (
        <p className="field__hint" id={`${inputId}-hint`}>
          {hint}
        </p>
      )}
      {error && (
        <p className="field__error" id={`${inputId}-error`} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
