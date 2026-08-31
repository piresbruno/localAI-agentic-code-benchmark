import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Spinner } from './Spinner.js';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  loading?: boolean;
  children: ReactNode;
}

/** Button with primary/secondary/danger variants, loading (spinner + disabled) and disabled states. */
export function Button({
  variant = 'primary',
  loading = false,
  disabled,
  children,
  className,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`btn btn--${variant}${loading ? ' btn--loading' : ''}${className ? ` ${className}` : ''}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && <Spinner size="small" />}
      {children}
    </button>
  );
}
