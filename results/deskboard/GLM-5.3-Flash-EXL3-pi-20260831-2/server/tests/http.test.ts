import { Booking, Room } from '@deskboard/shared';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Express } from 'express';
import { createApp } from '../src/app';
import { loadConfig } from '../src/config';
import { Clock } from '../src/services/ports';
import { SEED_ADMIN } from '../src/seed/seed';

/* ---- deterministic test context ---------------------------------------- */

let now: Date;
const clock: Clock = { now: () => now };
let app: Express;

beforeEach(async () => {
  now = new Date(2026, 8, 1, 8, 0); // Tuesday 08:00 local — fresh app + fixed clock per test
  app = await createApp(loadConfig({ JWT_SECRET: 'test-secret' }), { clock });
});

afterEach(() => {
  app = undefined as unknown as Express;
});

/** Naive local ISO strings for Sep 2026. */
const iso = (day: number, hour: number, minute = 0): string =>
  `2026-09-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(
    minute,
  ).padStart(2, '0')}`;

async function adminToken(): Promise<string> {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: SEED_ADMIN.email, password: SEED_ADMIN.password });
  return res.body.token as string;
}

async function employeeToken(email = 'dana@deskboard.local'): Promise<string> {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Dana Employee', email, password: 'long-enough-password' });
  return res.body.token as string;
}

const authed = (token: string) => request(app).get('/api/rooms').set('Authorization', `Bearer ${token}`);
const firstRoom = async (token: string): Promise<Room> => {
  const res = await authed(token);
  return res.body[0] as Room;
};

const expectErrorShape = (body: { error?: { code?: string; message?: string } }, code: string) => {
  expect(body.error).toBeDefined();
  expect(body.error?.code).toBe(code);
  expect(typeof body.error?.message).toBe('string');
};

/* ------------------------------------------------------------------------ */

describe('GET /health', () => {
  it('returns 200 ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});

describe('POST /api/auth/register', () => {
  it('creates an employee and returns a JWT', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Dana Employee', email: 'dana@deskboard.local', password: 'long-enough-password' });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('employee');
    expect(res.body.token).toBeDefined();
  });

  it('returns a 400 with the error contract for a short password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Dana', email: 'dana@deskboard.local', password: 'short' });
    expect(res.status).toBe(400);
    expectErrorShape(res.body, 'VALIDATION_ERROR');
    expect(res.body.error.details.password).toBeDefined();
  });

  it('returns a 409 for a duplicate email (case-insensitive)', async () => {
    await employeeToken();
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Dana Two', email: 'DANA@deskboard.local', password: 'long-enough-password' });
    expect(res.status).toBe(409);
    expectErrorShape(res.body, 'EMAIL_IN_USE');
  });
});

describe('POST /api/auth/login', () => {
  it('logs the seeded admin in', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: SEED_ADMIN.email, password: SEED_ADMIN.password });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('admin');
  });

  it('rejects wrong credentials with a 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: SEED_ADMIN.email, password: 'wrong-password' });
    expect(res.status).toBe(401);
    expectErrorShape(res.body, 'UNAUTHENTICATED');
  });
});

describe('GET /api/auth/me', () => {
  it('returns the authenticated user', async () => {
    const token = await adminToken();
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe(SEED_ADMIN.email);
  });

  it('rejects missing and malformed tokens with a 401', async () => {
    expect((await request(app).get('/api/auth/me')).status).toBe(401);
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
  });
});

describe('/api/rooms', () => {
  it('requires authentication for GET /rooms (401)', async () => {
    expect((await request(app).get('/api/rooms')).status).toBe(401);
  });

  it('lists the five seeded rooms for an authenticated user', async () => {
    const token = await employeeToken();
    const res = await authed(token);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(5);
    expect(res.body[0]).toMatchObject({ active: true });
  });

  it('forbids employees from creating rooms (403) and allows admins (201)', async () => {
    const employee = await employeeToken();
    const forbidden = await request(app)
      .post('/api/rooms')
      .set('Authorization', `Bearer ${employee}`)
      .send({ name: 'Keuka', capacity: 6, floor: 1, features: [] });
    expect(forbidden.status).toBe(403);
    expectErrorShape(forbidden.body, 'FORBIDDEN');

    const admin = await adminToken();
    const ok = await request(app)
      .post('/api/rooms')
      .set('Authorization', `Bearer ${admin}`)
      .send({ name: 'Keuka', capacity: 6, floor: 1, features: ['screen'] });
    expect(ok.status).toBe(201);
    expect(ok.body.id).toBeDefined();
  });

  it('returns 409 for a duplicate room name (case-insensitive)', async () => {
    const admin = await adminToken();
    const res = await request(app)
      .post('/api/rooms')
      .set('Authorization', `Bearer ${admin}`)
      .send({ name: 'hudson', capacity: 5, floor: 1, features: [] });
    expect(res.status).toBe(409);
    expectErrorShape(res.body, 'DUPLICATE_ROOM_NAME');
  });

  it('returns 400 for out-of-range room fields', async () => {
    const admin = await adminToken();
    const res = await request(app)
      .post('/api/rooms')
      .set('Authorization', `Bearer ${admin}`)
      .send({ name: 'Keuka', capacity: 101, floor: 1, features: [] });
    expect(res.status).toBe(400);
    expectErrorShape(res.body, 'VALIDATION_ERROR');
  });

  it('lets admins update and soft-deactivate rooms; deactivated rooms reject bookings', async () => {
    const admin = await adminToken();
    const room = await firstRoom(admin);

    const updated = await request(app)
      .put(`/api/rooms/${room.id}`)
      .set('Authorization', `Bearer ${admin}`)
      .send({ ...room, capacity: 9 });
    expect(updated.status).toBe(200);
    expect(updated.body.capacity).toBe(9);

    const deactivated = await request(app)
      .delete(`/api/rooms/${room.id}`)
      .set('Authorization', `Bearer ${admin}`);
    expect(deactivated.status).toBe(200);
    expect(deactivated.body.active).toBe(false);

    const booking = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${admin}`)
      .send({ roomId: room.id, title: 'Blocked', start: iso(1, 9), end: iso(1, 10), attendees: 2 });
    expect(booking.status).toBe(409);
    expectErrorShape(booking.body, 'ROOM_INACTIVE');
  });

  it('lets employees update nothing (403 on PUT/DELETE)', async () => {
    const employee = await employeeToken();
    const admin = await adminToken();
    const room = await firstRoom(admin);
    expect(
      (
        await request(app)
          .put(`/api/rooms/${room.id}`)
          .set('Authorization', `Bearer ${employee}`)
          .send(room)
      ).status,
    ).toBe(403);
    expect(
      (await request(app).delete(`/api/rooms/${room.id}`).set('Authorization', `Bearer ${employee}`))
        .status,
    ).toBe(403);
  });
});

describe('GET /api/rooms/:id/availability', () => {
  it('returns the hourly free/busy grid', async () => {
    const token = await employeeToken();
    const room = await firstRoom(token);
    await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({ roomId: room.id, title: 'Standup', start: iso(1, 9), end: iso(1, 10), attendees: 2 });

    const res = await request(app)
      .get(`/api/rooms/${room.id}/availability`)
      .query({ date: '2026-09-01' })
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.slots).toHaveLength(11);
    expect(res.body.slots.find((s: { start: string }) => s.start === '09:00')).toMatchObject({
      available: false,
      title: 'Standup',
    });
    expect(res.body.slots.find((s: { start: string }) => s.start === '10:00')?.available).toBe(true);
  });

  it('validates the date parameter (400) and unknown rooms (404)', async () => {
    const token = await employeeToken();
    const room = await firstRoom(token);
    const bad = await request(app)
      .get(`/api/rooms/${room.id}/availability`)
      .query({ date: '01-09-2026' })
      .set('Authorization', `Bearer ${token}`);
    expect(bad.status).toBe(400);

    const missing = await request(app)
      .get('/api/rooms/missing/availability')
      .query({ date: '2026-09-01' })
      .set('Authorization', `Bearer ${token}`);
    expect(missing.status).toBe(404);
  });
});

describe('/api/bookings', () => {
  it('creates a booking and lists it under /bookings/mine', async () => {
    const token = await employeeToken();
    const room = await firstRoom(token);
    const created = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({ roomId: room.id, title: 'Design review', start: iso(1, 14), end: iso(1, 15), attendees: 5 });
    expect(created.status).toBe(201);
    const booking = created.body as Booking;
    expect(booking.roomName).toBe(room.name);
    expect(booking.status).toBe('confirmed');

    const mine = await request(app)
      .get('/api/bookings/mine')
      .set('Authorization', `Bearer ${token}`);
    expect(mine.status).toBe(200);
    expect(mine.body).toHaveLength(1);
    expect(mine.body[0].title).toBe('Design review');
  });

  it('rejects overlapping bookings with a 409 ROOM_CONFLICT but allows back-to-back', async () => {
    const token = await employeeToken();
    const room = await firstRoom(token);
    const send = (start: string, end: string) =>
      request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${token}`)
        .send({ roomId: room.id, title: 'Meeting', start, end, attendees: 2 });

    expect((await send(iso(1, 9), iso(1, 10))).status).toBe(201);
    const clash = await send(iso(1, 9, 30), iso(1, 10, 30));
    expect(clash.status).toBe(409);
    expectErrorShape(clash.body, 'ROOM_CONFLICT');
    expect((await send(iso(1, 10), iso(1, 11))).status).toBe(201);
  });

  it('rejects_booking_over_capacity with a 422', async () => {
    const token = await employeeToken();
    const room = await firstRoom(token); // Hudson: capacity 8
    const res = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({ roomId: room.id, title: 'All hands', start: iso(1, 9), end: iso(1, 10), attendees: 9 });
    expect(res.status).toBe(422);
    expectErrorShape(res.body, 'RULE_VIOLATION');
  });

  it('rejects_booking_outside_business_hours with a 422 (weekend and after hours)', async () => {
    const token = await employeeToken();
    const room = await firstRoom(token);
    const weekend = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({ roomId: room.id, title: 'Weekend', start: iso(5, 10), end: iso(5, 11), attendees: 2 });
    expect(weekend.status).toBe(422);
    const late = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({ roomId: room.id, title: 'Late', start: iso(1, 18), end: iso(1, 20), attendees: 2 });
    expect(late.status).toBe(422);
  });

  it('returns 400 for a malformed booking body', async () => {
    const token = await employeeToken();
    const room = await firstRoom(token);
    const res = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({ roomId: room.id, start: iso(1, 9), end: iso(1, 10), attendees: 2 }); // title missing
    expect(res.status).toBe(400);
    expectErrorShape(res.body, 'VALIDATION_ERROR');
    expect(res.body.error.details.title).toBeDefined();
  });

  it('enforces the cancellation window over HTTP (organizer ok, stranger 403, unknown 404)', async () => {
    const organizer = await employeeToken();
    const room = await firstRoom(organizer);
    const created = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${organizer}`)
      .send({ roomId: room.id, title: 'To cancel', start: iso(1, 12), end: iso(1, 13), attendees: 2 });

    const stranger = await employeeToken('someone-else@deskboard.local');
    const forbidden = await request(app)
      .delete(`/api/bookings/${created.body.id}`)
      .set('Authorization', `Bearer ${stranger}`);
    expect(forbidden.status).toBe(403);
    expectErrorShape(forbidden.body, 'FORBIDDEN');

    now = new Date(2026, 8, 1, 11, 1); // inside the 1h window
    const tooLate = await request(app)
      .delete(`/api/bookings/${created.body.id}`)
      .set('Authorization', `Bearer ${organizer}`);
    expect(tooLate.status).toBe(422);

    now = new Date(2026, 8, 1, 10, 0); // outside the window
    const ok = await request(app)
      .delete(`/api/bookings/${created.body.id}`)
      .set('Authorization', `Bearer ${organizer}`);
    expect(ok.status).toBe(200);
    expect(ok.body.status).toBe('cancelled');

    expect(
      (await request(app).delete('/api/bookings/missing').set('Authorization', `Bearer ${organizer}`))
        .status,
    ).toBe(404);
  });

  it('lets admins cancel anytime over HTTP', async () => {
    const organizer = await employeeToken();
    const room = await firstRoom(organizer);
    const created = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${organizer}`)
      .send({ roomId: room.id, title: 'Admin cancels', start: iso(1, 9), end: iso(1, 10), attendees: 2 });
    now = new Date(2026, 8, 1, 16, 0); // long after start
    const admin = await adminToken();
    const res = await request(app)
      .delete(`/api/bookings/${created.body.id}`)
      .set('Authorization', `Bearer ${admin}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('cancelled');
  });
});

describe('unknown endpoints and error contract', () => {
  it('returns the JSON error contract for unknown API paths (404)', async () => {
    const res = await request(app).get('/api/definitely-not-a-route');
    expect(res.status).toBe(404);
    expectErrorShape(res.body, 'NOT_FOUND');
  });

  it('never leaks internals in error responses', async () => {
    const res = await request(app).post('/api/auth/register').send({}); // triggers validation path
    expect(JSON.stringify(res.body)).not.toMatch(/stack|node_modules|at \/|\/home\//);
  });
});
