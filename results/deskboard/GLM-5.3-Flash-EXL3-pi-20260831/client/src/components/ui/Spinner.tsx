/** Indeterminate loading indicator; announced via role="status". */
export function Spinner({ label = 'Loading' }: { label?: string }) {
  return <span className="spinner" role="status" aria-label={label} />;
}
