/**
 * Injectable ports for time and ID generation. Domain code never calls
 * `Date.now()` or generates ids directly — tests pass fixed implementations.
 */
export interface Clock {
  now(): Date;
}

export interface IdGen {
  next(): string;
}

export const systemClock: Clock = { now: () => new Date() };

export const uuidIdGen: IdGen = { next: () => crypto.randomUUID() };

/** Deterministic id generator for tests: room-1, room-2, … */
export const sequentialIdGen = (prefix = 'id'): IdGen => {
  let n = 0;
  return { next: () => `${prefix}-${++n}` };
};

/** Fixed clock for tests. */
export const fixedClock = (iso: string): Clock => {
  const t = new Date(iso);
  return { now: () => new Date(t.getTime()) };
};
