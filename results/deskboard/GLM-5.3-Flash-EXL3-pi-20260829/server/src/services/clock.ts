/**
 * Injectable time and identity providers. Domain logic never calls Date.now()
 * or generates ids directly — tests pass fixed implementations.
 */
export interface Clock {
  now(): Date;
}

export interface IdGen {
  next(): string;
}

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

export class UuidIdGen implements IdGen {
  next(): string {
    return crypto.randomUUID();
  }
}
