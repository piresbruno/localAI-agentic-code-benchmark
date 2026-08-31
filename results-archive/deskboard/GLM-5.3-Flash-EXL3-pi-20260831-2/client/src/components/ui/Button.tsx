import { ButtonHTMLAttributes } from 'react';
import { cx } from '../../lib/cx';
import { Spinner } from './Spinner';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  /** Shows a spinner and disables the button while an action is in flight. */
  loading?: boolean;
}

/** Action button with primary/secondary/danger variants and a loading state. */
export function Button({
  variant = 'primary',
  loading = false,
  disabled,
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={cx('btn', `btn-${variant}`, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && <Spinner size="sm" label="" />}
      <span className="btn-label">{children}</span>
    </button>
  );
}
