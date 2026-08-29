/** Shared test fixtures: fixed clock, sequential ids, fresh app factory, login helper. */
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../src/app.js';
import type { Config } from '../src/config.js';
import type { Clock, IdGen } from '../src/services/clock.js';

/** Clock returning a fixed instant; tests move it explicitly. */
export class FixedClock implements Clock {
  constructor(private current: Date = new Date('2026-08-31T08:00:00')) {} // a Monday

  now(): Date {
    return new Date(this.current);
  }

  set(iso: string): void {
    this.current = new Date(iso);
  }
}

/** Sequential readable ids: id-1, id-2, … */
export class SeqIdGen implements IdGen {
  private counter = 0;

  next(): string {
    this.counter += 1;
    return `id-${this.counter}`;
  }
}

export function testConfig(): Config {
  return {
    port: 0,
    jwtSecret: 'test-secret',
    seedRooms: undefined,
    clientDistDir: '../client/dist',
  };
}

export interface TestHarness {
  app: Express;
  clock: FixedClock;
}

/** Fresh app per test — in-memory state never leaks between tests. */
export function makeHarness(clock: FixedClock = new FixedClock()): TestHarness {
  const app = createApp(testConfig(), { clock, idGen: new SeqIdGen() });
  return { app, clock };
}

export async function registerAndLogin(
  app: Express,
  overrides: { email?: string; role?: 'admin' | 'employee' } = {},
): Promise<{ token: string; userId: string }> {
  const email = overrides.email ?? `user-${Math.random().toString(36).slice(2)}@example.com`;
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Test User', email, password: 'password123' });
  return { token: res.body.token, userId: res.body.user.id };
}

export async function adminToken(app: Express): Promise<string> {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: 'admin@deskboard.local', password: 'admin123' });
  return res.body.token as string;
}

/** Monday in the fixed-clock week, used as the canonical business day. */
export const MONDAY = '2026-08-31';

export async function createRoom(app: Express, token: string, name = 'Room X'): Promise<string> {
  const res = await request(app)
    .post('/api/rooms')
    .set('Authorization', `Bearer ${token}`)
    .send({ name, capacity: 10, floor: 2, features: [], active: true });
  return res.body.id as string;
}

export async function createBooking(
  app: Express,
  token: string,
  body: Record<string, unknown>,
): Promise<request.Response> {
  return request(app).post('/api/bookings').set('Authorization', `Bearer ${token}`).send(body);
}
