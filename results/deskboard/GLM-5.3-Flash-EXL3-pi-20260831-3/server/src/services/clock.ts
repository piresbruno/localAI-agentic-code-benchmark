/**
 * Injectable time and ID providers. Domain logic never calls Date.now()
 * or generates IDs directly — tests pass fixed implementations (spec §3).
 */
export interface Clock {
  now(): Date;
}

export interface IdGen {
  next(): string;
}

export const systemClock: Clock = { now: () => new Date() };

export const uuidIdGen: IdGen = { next: () => crypto.randomUUID() };
