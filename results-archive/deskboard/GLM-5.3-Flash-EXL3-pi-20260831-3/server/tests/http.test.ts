import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import type { AuthResponse, Booking, Room } from '@deskboard/shared';
import { createApp } from '../src/app.js';
import { MemoryUserRepository } from '../src/repositories/memoryUsers.js';
import { MemoryRoomRepository } from '../src/repositories/memoryRooms.js';
import { MemoryBookingRepository } from '../src/repositories/memoryBookings.js';
import { seedDefaultData, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD } from '../src/seed/seed.js';
import type { Clock, IdGen } from '../src/services/clock.js';

/** Fixed "now": Tuesday 2026-09-01, 12:00 local. */
const NOW = new Date(2026, 8, 1, 12, 0, 0);
const fixedClock: Clock = { now: () => NOW };
const seqIdGen: IdGen = (() => {
  let n = 0;
  return { next: () => `id-${++n}` };
})();

let app: Express;
let bookings: MemoryBookingRepository;

beforeEach(async () => {
  const users = new MemoryUserRepository();
  const rooms = new MemoryRoomRepository();
  bookings = new MemoryBookingRepository();
  await seedDefaultData(users, rooms, seqIdGen);
  app = createApp({
    users,
    rooms,
    bookings,
    clock: fixedClock,
    ids: seqIdGen,
    secret: 'test-secret',
  });
});

async function register(
  name: string,
  email: string,
  password = 'longenough1',
): Promise<AuthResponse> {
  const res = await request(app).post('/api/auth/register').send({ name, email, password });
  expect(res.status).toBe(201);
  return res.body as AuthResponse;
}

async function loginAdmin(): Promise<AuthResponse> {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: SEED_ADMIN_EMAIL, password: SEED_ADMIN_PASSWORD });
  expect(res.status).toBe(200);
  return res.body as AuthResponse;
}

/** Authorization header value for an authenticated agent. */
function authed(agent: AuthResponse): string {
  return `Bearer ${agent.token}`;
}

async function seedRoom(admin: AuthResponse, over: Partial<Room> = {}): Promise<Room> {
  const res = await request(app)
    .post('/api/rooms')
    .set('Authorization', authed(admin))
    .send({
      name: 'Crashpad',
      capacity: 10,
      floor: 3,
      features: ['screen'],
      active: true,
      ...over,
    });
  expect(res.status).toBe(201);
  return res.body as Room;
}

function bookingBody(roomId: string, over = {}) {
  return {
    roomId,
    title: 'Sprint planning',
    start: '2026-09-01T13:00',
    end: '2026-09-01T14:00',
    attendees: 4,
    ...over,
  };
}

describe('GET /api/health', () => {
  it('reports ok without authentication', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});

describe('GET /api-docs', () => {
  it('serves the Swagger UI describing every endpoint', async () => {
    const res = await request(app).get('/api-docs/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('swagger-ui');
    const spec = await request(app).get('/api-docs.json');
    expect(spec.status).toBe(200);
    const paths = Object.keys(spec.body.paths);
    expect(paths).toEqual(
      expect.arrayContaining([
        '/health',
        '/auth/register',
        '/auth/login',
        '/auth/me',
        '/rooms',
        '/rooms/{id}',
        '/rooms/{id}/availability',
        '/bookings',
        '/bookings/mine',
        '/bookings/{id}',
      ]),
    );
  });
});

describe('auth endpoints', () => {
  it('registers an employee, logs in, and reads the profile', async () => {
    const { token, user } = await register('Ana', 'ana@office.local');
    expect(user.role).toBe('employee');

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ana@office.local', password: 'longenough1' });
    expect(login.status).toBe(200);
    expect(login.body.token).toBeTruthy();

    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(me.status).toBe(200);
    expect(me.body).toEqual(user);
  });

  it('returns 400 with field errors for invalid registration bodies', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: '', email: 'nope', password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toHaveProperty('name');
  });

  it('returns 401 for bad credentials and 409 for duplicate email', async () => {
    await register('Ana', 'ana@office.local');
    const bad = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ana@office.local', password: 'wrong-password' });
    expect(bad.status).toBe(401);
    expect(bad.body.error.code).toBe('UNAUTHENTICATED');

    const dup = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Ana 2', email: 'ANA@OFFICE.LOCAL', password: 'longenough1' });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('returns 401 for /me without a token and with a garbage token', async () => {
    expect((await request(app).get('/api/auth/me')).status).toBe(401);
    const garbage = await request(app).get('/api/auth/me').set('Authorization', 'Bearer not-a-jwt');
    expect(garbage.status).toBe(401);
    expect(garbage.body.error.code).toBe('UNAUTHENTICATED');
  });
});

describe('rooms endpoints', () => {
  it('requires authentication for GET /rooms', async () => {
    expect((await request(app).get('/api/rooms')).status).toBe(401);
  });

  it('seeds and lists the default rooms', async () => {
    const admin = await loginAdmin();
    const res = await request(app).get('/api/rooms').set('Authorization', authed(admin));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(5);
    expect(res.body[0]).toMatchObject({ name: 'Board Room', active: true });
  });

  it('lets admins create rooms and rejects employees with 403', async () => {
    const admin = await loginAdmin();
    const employee = await register('Ana', 'ana@office.local');

    const asEmployee = await request(app)
      .post('/api/rooms')
      .set('Authorization', authed(employee))
      .send({ name: 'X', capacity: 5, floor: 1 });
    expect(asEmployee.status).toBe(403);
    expect(asEmployee.body.error.code).toBe('FORBIDDEN');

    const asAdmin = await request(app)
      .post('/api/rooms')
      .set('Authorization', authed(admin))
      .send({ name: 'Vitable', capacity: 5, floor: 1 });
    expect(asAdmin.status).toBe(201);
    expect(asAdmin.body).toMatchObject({ name: 'Vitable', active: true, features: [] });
  });

  it('returns 409 on duplicate room names case-insensitively', async () => {
    const admin = await loginAdmin();
    const room = await seedRoom(admin, { name: 'Crashpad' });
    const res = await request(app)
      .post('/api/rooms')
      .set('Authorization', authed(admin))
      .send({ name: ' CRASHPAD ', capacity: 5, floor: 1 });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ROOM_NAME_TAKEN');
    expect(res.body.error.message).toMatch(/already exists/i);
    void room;
  });

  it('returns 400 for invalid room payloads', async () => {
    const admin = await loginAdmin();
    const res = await request(app)
      .post('/api/rooms')
      .set('Authorization', authed(admin))
      .send({ name: 'Bad', capacity: 500, floor: 99 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('updates rooms (admin) and 404s unknown ids', async () => {
    const admin = await loginAdmin();
    const room = await seedRoom(admin);
    const res = await request(app)
      .put(`/api/rooms/${room.id}`)
      .set('Authorization', authed(admin))
      .send({ capacity: 20 });
    expect(res.status).toBe(200);
    expect(res.body.capacity).toBe(20);

    const ghost = await request(app)
      .put('/api/rooms/ghost')
      .set('Authorization', authed(admin))
      .send({ capacity: 20 });
    expect(ghost.status).toBe(404);
  });

  it('soft-deactivates rooms (admin) so they reject new bookings but keep history', async () => {
    const admin = await loginAdmin();
    const room = await seedRoom(admin);
    const employee = await register('Ana', 'ana@office.local');
    const booking = await request(app)
      .post('/api/bookings')
      .set('Authorization', authed(employee))
      .send(bookingBody(room.id));
    expect(booking.status).toBe(201);

    const employeeDelete = await request(app)
      .delete(`/api/rooms/${room.id}`)
      .set('Authorization', authed(employee));
    expect(employeeDelete.status).toBe(403);

    const res = await request(app)
      .delete(`/api/rooms/${room.id}`)
      .set('Authorization', authed(admin));
    expect(res.status).toBe(200);
    expect(res.body.active).toBe(false);

    const newBooking = await request(app)
      .post('/api/bookings')
      .set('Authorization', authed(employee))
      .send(bookingBody(room.id, { start: '2026-09-01T16:00', end: '2026-09-01T17:00' }));
    expect(newBooking.status).toBe(409);
    expect(newBooking.body.error.code).toBe('ROOM_INACTIVE');

    // Existing booking survives.
    const mine = await request(app)
      .get('/api/bookings/mine')
      .set('Authorization', authed(employee));
    expect(mine.body).toHaveLength(1);
  });
});

describe('availability endpoint', () => {
  it('returns the hourly free/busy grid', async () => {
    const admin = await loginAdmin();
    const employee = await register('Ana', 'ana@office.local');
    const room = await seedRoom(admin);
    await request(app)
      .post('/api/bookings')
      .set('Authorization', authed(employee))
      .send(bookingBody(room.id));

    const res = await request(app)
      .get(`/api/rooms/${room.id}/availability?date=2026-09-01`)
      .set('Authorization', authed(employee));
    expect(res.status).toBe(200);
    expect(res.body.slots).toHaveLength(11);
    expect(res.body.slots.filter((s: { available: boolean }) => !s.available)).toEqual([
      { start: '13:00', end: '14:00', available: false },
    ]);
  });

  it('validates the date query and unknown rooms', async () => {
    const admin = await loginAdmin();
    const room = await seedRoom(admin);
    const bad = await request(app)
      .get(`/api/rooms/${room.id}/availability?date=nope`)
      .set('Authorization', authed(admin));
    expect(bad.status).toBe(400);
    const ghost = await request(app)
      .get('/api/rooms/ghost/availability?date=2026-09-01')
      .set('Authorization', authed(admin));
    expect(ghost.status).toBe(404);
    const noAuth = await request(app).get(`/api/rooms/${room.id}/availability?date=2026-09-01`);
    expect(noAuth.status).toBe(401);
  });
});

describe('bookings endpoints', () => {
  it('creates a booking and returns the DTO with room name', async () => {
    const admin = await loginAdmin();
    const employee = await register('Ana', 'ana@office.local');
    const room = await seedRoom(admin);
    const res = await request(app)
      .post('/api/bookings')
      .set('Authorization', authed(employee))
      .send(bookingBody(room.id));
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      roomName: 'Crashpad',
      status: 'confirmed',
      organizerId: employee.user.id,
    });
  });

  it('returns 400 for malformed booking bodies', async () => {
    const admin = await loginAdmin();
    const room = await seedRoom(admin);
    const res = await request(app)
      .post('/api/bookings')
      .set('Authorization', authed(admin))
      .send({ roomId: room.id, title: '', start: 'bad', end: 'bad', attendees: 0 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 409 ROOM_CONFLICT for overlapping bookings', async () => {
    const admin = await loginAdmin();
    const employee = await register('Ana', 'ana@office.local');
    const room = await seedRoom(admin);
    await request(app)
      .post('/api/bookings')
      .set('Authorization', authed(employee))
      .send(bookingBody(room.id));
    const res = await request(app)
      .post('/api/bookings')
      .set('Authorization', authed(employee))
      .send(bookingBody(room.id, { start: '2026-09-01T13:30', end: '2026-09-01T14:30' }));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ROOM_CONFLICT');
  });

  it('returns 422 for capacity and business-hour violations', async () => {
    const admin = await loginAdmin();
    const room = await seedRoom(admin, { capacity: 2 });
    const employee = await register('Ana', 'ana@office.local');
    const token = authed(employee);

    const capacity = await request(app)
      .post('/api/bookings')
      .set('Authorization', token)
      .send(bookingBody(room.id, { attendees: 3 }));
    expect(capacity.status).toBe(422);
    expect(capacity.body.error.code).toBe('CAPACITY_EXCEEDED');

    const hours = await request(app)
      .post('/api/bookings')
      .set('Authorization', token)
      .send(bookingBody(room.id, { start: '2026-09-01T07:00', end: '2026-09-01T08:00' }));
    expect(hours.status).toBe(422);
    expect(hours.body.error.code).toBe('RULE_VIOLATION');
  });

  it('lists only own bookings on /mine, with computed completion', async () => {
    const admin = await loginAdmin();
    const ana = await register('Ana', 'ana@office.local');
    const bruno = await register('Bruno', 'bruno@office.local');
    const room = await seedRoom(admin);

    await request(app)
      .post('/api/bookings')
      .set('Authorization', authed(ana))
      .send(bookingBody(room.id, { start: '2026-09-01T10:00', end: '2026-09-01T11:00' }));
    await request(app)
      .post('/api/bookings')
      .set('Authorization', authed(bruno))
      .send(bookingBody(room.id, { start: '2026-09-01T15:00', end: '2026-09-01T16:00' }));

    const mine = await request(app).get('/api/bookings/mine').set('Authorization', authed(ana));
    expect(mine.status).toBe(200);
    expect(mine.body).toHaveLength(1);
    expect(mine.body[0].status).toBe('completed'); // ended at 11:00, now is 12:00
  });

  it('cancels via DELETE with the cancellation-window rules', async () => {
    const admin = await loginAdmin();
    const ana = await register('Ana', 'ana@office.local');
    const bruno = await register('Bruno', 'bruno@office.local');
    const room = await seedRoom(admin);
    const token = authed(ana);

    // 13:00 start vs NOW 12:00 → exactly 1h away, still cancellable by organizer.
    const booking: { body: Booking } = await request(app)
      .post('/api/bookings')
      .set('Authorization', token)
      .send(bookingBody(room.id));
    const cancel = await request(app)
      .delete(`/api/bookings/${booking.body.id}`)
      .set('Authorization', token);
    expect(cancel.status).toBe(200);
    expect(cancel.body.status).toBe('cancelled');

    // Other employee: never allowed, even inside the window.
    const b2: { body: Booking } = await request(app)
      .post('/api/bookings')
      .set('Authorization', token)
      .send(bookingBody(room.id, { start: '2026-09-01T14:00', end: '2026-09-01T15:00' }));
    const other = await request(app)
      .delete(`/api/bookings/${b2.body.id}`)
      .set('Authorization', authed(bruno));
    expect(other.status).toBe(403);
    expect(other.body.error.code).toBe('CANCEL_FORBIDDEN');

    // Organizer with less than 1h left: window closed.
    const b3: { body: Booking } = await request(app)
      .post('/api/bookings')
      .set('Authorization', token)
      .send(bookingBody(room.id, { start: '2026-09-01T12:30', end: '2026-09-01T13:30' }));
    const late = await request(app)
      .delete(`/api/bookings/${b3.body.id}`)
      .set('Authorization', token);
    expect(late.status).toBe(403);
    expect(late.body.error.code).toBe('CANCELLATION_WINDOW_CLOSED');

    // Admin can cancel anytime.
    const adminCancel = await request(app)
      .delete(`/api/bookings/${b3.body.id}`)
      .set('Authorization', authed(admin));
    expect(adminCancel.status).toBe(200);
    expect(adminCancel.body.status).toBe('cancelled');
  });

  it('returns 404 when cancelling an unknown booking', async () => {
    const admin = await loginAdmin();
    const res = await request(app)
      .delete('/api/bookings/ghost')
      .set('Authorization', authed(admin));
    expect(res.status).toBe(404);
  });
});

describe('error contract', () => {
  it('shapes every failure as { error: { code, message } }', async () => {
    const res = await request(app).get('/api/rooms');
    expect(res.status).toBe(401);
    expect(res.body.error).toHaveProperty('code');
    expect(res.body.error).toHaveProperty('message');
    expect(typeof res.body.error.message).toBe('string');
  });

  it('returns JSON 404 (not HTML) for unknown API routes', async () => {
    const res = await request(app).get('/api/definitely-not-a-route');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

describe('seed', () => {
  it('creates the admin account exactly once (idempotent)', async () => {
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: SEED_ADMIN_EMAIL, password: SEED_ADMIN_PASSWORD });
    expect(login.status).toBe(200);
    expect(login.body.user.role).toBe('admin');
  });
});
