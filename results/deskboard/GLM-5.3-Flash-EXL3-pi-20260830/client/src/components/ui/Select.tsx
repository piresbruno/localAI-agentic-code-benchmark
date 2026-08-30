/** Select — labeled dropdown with an error message slot. */
export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string | null;
  hint?: string;
  options: { value: string; label: string }[];
}

export function Select({ label, error, hint, options, id, ...rest }: SelectProps) {
  const selectId = id ?? `select-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  return (
    <div className="field">
      <label className="field__label" htmlFor={selectId}>
        {label}
      </label>
      <select
        id={selectId}
        className={`field__input${error ? ' field__input--error' : ''}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={hint ? `${selectId}-hint` : undefined}
        {...rest}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint && !error && (
        <p className="field__hint" id={`${selectId}-hint`}>
          {hint}
        </p>
      )}
      {error && (
        <p className="field__error" id={`${selectId}-error`} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
