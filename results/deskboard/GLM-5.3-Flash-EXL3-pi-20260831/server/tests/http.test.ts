import type { Express } from 'express';
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';

const WED = '2026-09-02'; // Wednesday
const SAT = '2026-09-05';
const NOW = new Date('2026-09-02T10:00:00');
const SECRET = 'test-secret';

/** Fresh app instance per test (spec §8) with a deterministic clock. */
const app = () => createApp({ jwtSecret: SECRET, clock: { now: () => NOW } });

let seq = 0;
async function employeeToken(a: Express): Promise<string> {
  const res = await request(a)
    .post('/api/auth/register')
    .send({ name: `Emp ${++seq}`, email: `emp${seq}@test.local`, password: 'password-123' });
  return res.body.token as string;
}

async function adminToken(a: Express): Promise<string> {
  const res = await request(a)
    .post('/api/auth/login')
    .send({ email: 'admin@deskboard.local', password: 'admin123' });
  return res.body.token as string;
}

async function firstRoomId(a: Express, token: string): Promise<string> {
  const res = await request(a).get('/api/rooms').set('Authorization', `Bearer ${token}`);
  return res.body[0].id as string;
}

describe('health & docs', () => {
  it('GET /api/health and GET /health return 200', async () => {
    for (const path of ['/api/health', '/health']) {
      const res = await request(app()).get(path);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    }
  });

  it('GET /api-docs serves Swagger UI', async () => {
    const res = await request(app()).get('/api-docs/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Swagger UI');
  });
});

describe('auth endpoints', () => {
  it('registers an employee and returns a JWT', async () => {
    const res = await request(app())
      .post('/api/auth/register')
      .send({ name: 'Nina', email: 'nina@test.local', password: 'password-123' });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('employee');
    expect(res.body.token).toBeTruthy();
  });

  it('400s on invalid registration bodies with error details', async () => {
    const res = await request(app()).post('/api/auth/register').send({ name: '', email: 'nope', password: 'x' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.length).toBeGreaterThan(0);
  });

  it('409s on duplicate emails', async () => {
    const a = app();
    await request(a).post('/api/auth/register').send({ name: 'Nina', email: 'nina@test.local', password: 'password-123' });
    const res = await request(a)
      .post('/api/auth/register')
      .send({ name: 'Nina 2', email: 'NINA@test.local', password: 'password-123' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('logs in with seeded admin credentials; 401 on bad password', async () => {
    const a = app();
    const ok = await request(a).post('/api/auth/login').send({ email: 'admin@deskboard.local', password: 'admin123' });
    expect(ok.status).toBe(200);
    expect(ok.body.user.role).toBe('admin');
    const bad = await request(a).post('/api/auth/login').send({ email: 'admin@deskboard.local', password: 'wrong' });
    expect(bad.status).toBe(401);
    expect(bad.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('GET /auth/me requires a valid token (401 without)', async () => {
    const a = app();
    expect((await request(a).get('/api/auth/me')).status).toBe(401);
    const token = await adminToken(a);
    const res = await request(a).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe('admin@deskboard.local');
    expect((await request(a).get('/api/auth/me').set('Authorization', 'Bearer junk')).status).toBe(401);
  });
});

describe('rooms endpoints', () => {
  it('requires auth for GET /rooms (401)', async () => {
    expect((await request(app()).get('/api/rooms')).status).toBe(401);
  });

  it('lists the seeded rooms for authenticated users', async () => {
    const a = app();
    const token = await employeeToken(a);
    const res = await request(a).get('/api/rooms').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(4);
    expect(res.body.map((r: { name: string }) => r.name)).toEqual(['Fjord', 'Aurora', 'Summit', 'Pod']);
  });

  it('creates rooms for admins only (403 for employees, 400 invalid, 409 duplicate)', async () => {
    const a = app();
    const admin = await adminToken(a);
    const emp = await employeeToken(a);
    expect(
      (await request(a).post('/api/rooms').set('Authorization', `Bearer ${emp}`).send({ name: 'X', capacity: 4, floor: 2 })).status,
    ).toBe(403);
    const created = await request(a)
      .post('/api/rooms')
      .set('Authorization', `Bearer ${admin}`)
      .send({ name: 'Boardroom', capacity: 10, floor: 5, features: ['screen'] });
    expect(created.status).toBe(201);
    expect(created.body.active).toBe(true);
    expect(
      (await request(a).post('/api/rooms').set('Authorization', `Bearer ${admin}`).send({ name: 'boardroom', capacity: 4, floor: 2 })).status,
    ).toBe(409);
    const invalid = await request(a)
      .post('/api/rooms')
      .set('Authorization', `Bearer ${admin}`)
      .send({ name: 'Y', capacity: 0, floor: 2 });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.details.some((d: { field: string }) => d.field === 'capacity')).toBe(true);
  });

  it('updates and soft-deactivates rooms (404 unknown, 403 employee)', async () => {
    const a = app();
    const admin = await adminToken(a);
    const emp = await employeeToken(a);
    const roomId = await firstRoomId(a, admin);
    const updated = await request(a)
      .put(`/api/rooms/${roomId}`)
      .set('Authorization', `Bearer ${admin}`)
      .send({ capacity: 9 });
    expect(updated.status).toBe(200);
    expect(updated.body.capacity).toBe(9);
    expect(
      (await request(a).put(`/api/rooms/${roomId}`).set('Authorization', `Bearer ${emp}`).send({ capacity: 9 })).status,
    ).toBe(403);
    expect((await request(a).put('/api/rooms/nope').set('Authorization', `Bearer ${admin}`).send({})).status).toBe(404);
    const deactivated = await request(a).delete(`/api/rooms/${roomId}`).set('Authorization', `Bearer ${admin}`);
    expect(deactivated.status).toBe(200);
    expect(deactivated.body.active).toBe(false);
  });

  it('returns the availability grid; 400 on bad date, 404 unknown room', async () => {
    const a = app();
    const token = await employeeToken(a);
    const roomId = await firstRoomId(a, token);
    const res = await request(a).get(`/api/rooms/${roomId}/availability?date=${WED}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.slots).toHaveLength(11);
    expect((await request(a).get(`/api/rooms/${roomId}/availability?date=nope`).set('Authorization', `Bearer ${token}`)).status).toBe(400);
    expect((await request(a).get(`/api/rooms/nope/availability?date=${WED}`).set('Authorization', `Bearer ${token}`)).status).toBe(404);
  });
});

describe('bookings endpoints', () => {
  async function booking(a: Express, token: string, overrides: object = {}) {
    const roomId = await firstRoomId(a, token);
    return request(a)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({ roomId, title: 'Sprint sync', start: `${WED}T11:00`, end: `${WED}T12:00`, attendees: 3, ...overrides });
  }

  it('creates bookings; 401 unauthenticated; 400 invalid body', async () => {
    expect((await request(app()).post('/api/bookings').send({})).status).toBe(401);
    const a = app();
    const token = await employeeToken(a);
    expect((await booking(a, token)).status).toBe(201);
    const bad = await request(a)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({ roomId: 'r', title: '', start: `${WED}T11:00`, end: `${WED}T12:00`, attendees: 1 });
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('409 ROOM_CONFLICT on overlap, adjacent slots allowed', async () => {
    const a = app();
    const t1 = await employeeToken(a);
    const t2 = await employeeToken(a);
    await booking(a, t1);
    const overlap = await request(a)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${t2}`)
      .send(await bookingBody(a, t2, { start: `${WED}T11:30`, end: `${WED}T12:30` }));
    expect(overlap.status).toBe(409);
    expect(overlap.body.error.code).toBe('ROOM_CONFLICT');
    const adjacent = await request(a)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${t2}`)
      .send(await bookingBody(a, t2, { start: `${WED}T12:00`, end: `${WED}T13:00` }));
    expect(adjacent.status).toBe(201);
  });

  it('422 outside business hours / over capacity / too long; 409 inactive room', async () => {
    const a = app();
    const token = await employeeToken(a);
    const weekend = await booking(a, token, { start: `${SAT}T11:00`, end: `${SAT}T12:00` });
    expect(weekend.status).toBe(422);
    expect(weekend.body.error.code).toBe('OUTSIDE_BUSINESS_HOURS');
    const cap = await booking(a, token, { attendees: 99 });
    expect(cap.status).toBe(422);
    expect(cap.body.error.code).toBe('OVER_CAPACITY');
    const long = await booking(a, token, { start: `${WED}T10:00`, end: `${WED}T14:01` });
    expect(long.status).toBe(422);
    expect(long.body.error.code).toBe('DURATION_EXCEEDS_LIMIT');
    const admin = await adminToken(a);
    const roomId = await firstRoomId(a, token);
    await request(a).delete(`/api/rooms/${roomId}`).set('Authorization', `Bearer ${admin}`);
    const inactive = await booking(a, token, { start: `${WED}T14:00`, end: `${WED}T15:00` });
    expect(inactive.status).toBe(409);
    expect(inactive.body.error.code).toBe('ROOM_INACTIVE');
  });

  it('GET /bookings/mine lists only own bookings with computed completed status', async () => {
    const a = app();
    const t1 = await employeeToken(a);
    const t2 = await employeeToken(a);
    await booking(a, t1, { start: `${WED}T08:00`, end: `${WED}T09:00` }); // past relative to NOW
    await booking(a, t1, { start: `${WED}T14:00`, end: `${WED}T15:00` }); // future
    const mine = await request(a).get('/api/bookings/mine').set('Authorization', `Bearer ${t1}`);
    expect(mine.status).toBe(200);
    expect(mine.body).toHaveLength(2);
    expect(mine.body.find((b: { start: string }) => b.start.endsWith('T08:00')).status).toBe('completed');
    expect(mine.body.find((b: { start: string }) => b.start.endsWith('T14:00')).status).toBe('confirmed');
    const other = await request(a).get('/api/bookings/mine').set('Authorization', `Bearer ${t2}`);
    expect(other.body).toHaveLength(0);
  });

  it('DELETE /bookings/:id: organizer inside window ok, other employee 403, window passed 422, admin anytime, 404 unknown', async () => {
    const a = app();
    const t1 = await employeeToken(a);
    const t2 = await employeeToken(a);
    const admin = await adminToken(a);
    const future = await booking(a, t1); // starts 11:00, deadline 10:00 == NOW
    expect((await request(a).delete(`/api/bookings/${future.body.id}`).set('Authorization', `Bearer ${t2}`)).status).toBe(403);
    expect(
      (await request(a).delete(`/api/bookings/${future.body.id}`).set('Authorization', `Bearer ${t1}`)).body.status,
    ).toBe('cancelled');
    const soon = await booking(a, t1, { start: `${WED}T10:30`, end: `${WED}T11:30` }); // deadline 09:30 < NOW
    const tooLate = await request(a).delete(`/api/bookings/${soon.body.id}`).set('Authorization', `Bearer ${t1}`);
    expect(tooLate.status).toBe(422);
    expect(tooLate.body.error.code).toBe('CANCELLATION_WINDOW_PASSED');
    expect((await request(a).delete(`/api/bookings/${soon.body.id}`).set('Authorization', `Bearer ${admin}`)).status).toBe(200);
    expect((await request(a).delete('/api/bookings/nope').set('Authorization', `Bearer ${admin}`)).status).toBe(404);
  });
});

describe('error contract & 404', () => {
  it('unknown /api routes return JSON 404; error bodies always carry code+message', async () => {
    const res = await request(app()).get('/api/definitely-not-a-route');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(typeof res.body.error.message).toBe('string');
  });

  it('malformed JSON bodies map to 400 VALIDATION_ERROR', async () => {
    const res = await request(app())
      .post('/api/auth/register')
      .set('Content-Type', 'application/json')
      .send('{"broken":');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

async function bookingBody(a: Express, token: string, overrides: object) {
  const roomId = await firstRoomId(a, token);
  return { roomId, title: 'Sprint sync', start: `${WED}T11:00`, end: `${WED}T12:00`, attendees: 3, ...overrides };
}
