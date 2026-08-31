/** Injectable time source — domain code never calls `new Date()` directly. */
export interface Clock {
  now(): Date;
}

/** Injectable id generator — tests pass deterministic ids. */
export interface IdGen {
  next(): string;
}

export const systemClock: Clock = { now: () => new Date() };
export const uuidIdGen: IdGen = { next: () => crypto.randomUUID() };
