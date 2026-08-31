/**
 * Injectable side-effect ports. The domain depends on these interfaces only —
 * production wiring uses real implementations, tests pass fixed values.
 */
export interface Clock {
  /** Current time; the only time source the domain may use. */
  now(): Date;
}

export interface IdGen {
  /** Next unique identifier. */
  next(): string;
}
