/** Visual loading indicator, exposed to assistive tech via role="status". */
export function Spinner({ label = 'Loading', size = 'md' }: { label?: string; size?: 'sm' | 'md' }) {
  return <span className={`spinner spinner-${size}`} role="status" aria-label={label} />;
}
