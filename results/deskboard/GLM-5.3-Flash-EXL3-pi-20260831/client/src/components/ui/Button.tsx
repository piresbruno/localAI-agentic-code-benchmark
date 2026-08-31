import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Spinner } from './Spinner';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  /** Shows a spinner and disables the button while in flight (double-submit safe). */
  loading?: boolean;
  children: ReactNode;
}

/** Variant button with hover/focus-visible/disabled/loading states (spec §7.2). */
export function Button({ variant = 'primary', loading = false, disabled, children, type, ...rest }: ButtonProps) {
  return (
    <button
      className={`btn btn--${variant}`}
      type={type ?? 'button'}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && <Spinner label="Working" />}
      <span>{children}</span>
    </button>
  );
}
