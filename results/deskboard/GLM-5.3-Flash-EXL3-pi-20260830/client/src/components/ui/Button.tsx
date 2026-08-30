/** Button — variants primary/secondary/danger with loading and disabled states. */
import { Spinner } from './Spinner.js';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  loading?: boolean;
}

export function Button({
  variant = 'primary',
  loading = false,
  disabled,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`btn btn--${variant}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && <Spinner size="sm" label="In progress" />}
      {children}
    </button>
  );
}
