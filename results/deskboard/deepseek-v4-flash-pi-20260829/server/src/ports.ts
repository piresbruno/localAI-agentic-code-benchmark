/**
 * Ports for time and ID generation. Injected into every service and store so
 * tests can provide fixed values; wired to the real clock/randomness in main.ts.
 */

export interface Clock {
  now(): Date;
}

export interface IdGen {
  next(): string;
}
