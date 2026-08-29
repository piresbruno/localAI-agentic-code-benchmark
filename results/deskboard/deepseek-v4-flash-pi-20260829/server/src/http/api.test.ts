/**
 * HTTP integration tests: every §5 endpoint exercised through the real
 * Express app (fresh instance + fixed clock/ids per test file state).
 */
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { SEEDED_ADMIN_EMAIL, SEEDED_ADMIN_PASSWORD } from '../seed/seed.js';
import type { Clock, IdGen } from '../ports.js';
import type { Room } from 'shared';

// Local-context helpers (deterministic in any TZ, like the service tests).
const local = (y: number, m: number, d: number, h = 0, min = 0) =>
  new Date(y, m - 1, d, h, min, 0, 0);
const NOW = { value: local(2026, 8, 25, 10, 0) }; // Tuesday 2026-08-25 10:00
const clock: Clock = { now: () => NOW.value };
let id = 1;
const idGen: IdGen = { next: () => `id-${id++}` };

const SECRET = 'test-secret';
const THU = '2026-08-27';

type App = ReturnType<typeof createApp>;
let app: App;
let empTokenCache: string | undefined;

async function registerEmployee(email = 'grace@example.com', password = 'supersecret') {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Grace Hopper', email, password });
  return res;
}

/** One registered employee per app instance (registration is idempotent per test). */
async function employeeToken() {
  if (empTokenCache) return empTokenCache;
  const res = await registerEmployee();
  empTokenCache = res.body.token as string;
  return empTokenCache!;
}

async function adminToken() {
  const res = await request(app).post('/api/auth/login').send({
    email: SEEDED_ADMIN_EMAIL,
    password: SEEDED_ADMIN_PASSWORD,
  });
  return res.body.token as string;
}

async function firstRoomId(): Promise<string> {
  const res = await request(app)
    .get('/api/rooms')
    .set('Authorization', `Bearer ${await employeeToken()}`);
  return (res.body as Room[])[0]!.id;
}

/** Local 2026-08-27 at hh:mm → ISO (TZ-independent: always inside business hours). */
const startIso = (hhmm: string) =>
  local(2026, 8, 27, Number(hhmm.slice(0, 2)), Number(hhmm.slice(3))).toISOString();

async function bookThu(token: string, roomId: string, start = '14:00') {
  return request(app)
    .post('/api/bookings')
    .set('Authorization', `Bearer ${token}`)
    .send({
      roomId,
      title: 'Sprint planning',
      start: startIso(start),
      durationMinutes: 60,
      attendees: 4,
      recurrence: { kind: 'none' },
    });
}

beforeEach(() => {
  id = 1;
  NOW.value = local(2026, 8, 25, 10, 0);
  empTokenCache = undefined;
  app = createApp({ clock, idGen, jwtSecret: SECRET, seed: true });
});

// ---------------------------------------------------------------------------
describe('GET /health', () => {
  it('is public and reports ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});

// ---------------------------------------------------------------------------
describe('auth endpoints', () => {
  it('registers an employee and returns a JWT', async () => {
    const res = await registerEmployee();
    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user).toMatchObject({ email: 'grace@example.com', role: 'employee' });
  });

  it('rejects a duplicate email with 409', async () => {
    await registerEmployee();
    const res = await registerEmployee('GRACE@example.com');
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('validates the body with 400 + details', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: '', email: 'nope', password: 'x' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.email).toBeTruthy();
  });

  it('logs in with valid credentials', async () => {
    await registerEmployee();
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'grace@example.com', password: 'supersecret' });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('employee');
  });

  it('logs in the seeded admin', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: SEEDED_ADMIN_EMAIL, password: SEEDED_ADMIN_PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('admin');
  });

  it('rejects bad credentials with 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'grace@example.com', password: 'wrong' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('returns the current user from /me', async () => {
    const token = await employeeToken();
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe('grace@example.com');
  });

  it('rejects /me without a token (401)', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects /me with a garbage token (401)', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer not-a-token');
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
describe('room endpoints', () => {
  it('lists the seeded rooms for any authenticated user', async () => {
    const token = await employeeToken();
    const res = await request(app).get('/api/rooms').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(6);
    expect(res.body[0].name).toBeTruthy();
  });

  it('requires authentication to list rooms', async () => {
    const res = await request(app).get('/api/rooms');
    expect(res.status).toBe(401);
  });

  it('lets an admin create a room (201)', async () => {
    const res = await request(app)
      .post('/api/rooms')
      .set('Authorization', `Bearer ${await adminToken()}`)
      .send({ name: 'Nova', capacity: 10, floor: 2, features: ['screen', 'whiteboard'] });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: 'Nova', active: true });
  });

  it('forbids employees from creating rooms (403)', async () => {
    const res = await request(app)
      .post('/api/rooms')
      .set('Authorization', `Bearer ${await employeeToken()}`)
      .send({ name: 'Nova', capacity: 10, floor: 2, features: [] });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('rejects duplicate room names case-insensitively (409)', async () => {
    const roomId = await firstRoomId();
    const room = (
      await request(app)
        .get('/api/rooms')
        .set('Authorization', `Bearer ${await employeeToken()}`)
    ).body as Room[];
    const token = await adminToken();
    const res = await request(app)
      .post('/api/rooms')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: room.find((r) => r.id === roomId)!.name.toUpperCase(),
        capacity: 5,
        floor: 1,
        features: [],
      });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ROOM_NAME_TAKEN');
  });

  it('validates room bodies (400)', async () => {
    const res = await request(app)
      .post('/api/rooms')
      .set('Authorization', `Bearer ${await adminToken()}`)
      .send({ name: 'Nova', capacity: 500, floor: 0, features: ['hologram'] });
    expect(res.status).toBe(400);
  });

  it('lets an admin update a room; 404 for unknown rooms', async () => {
    const token = await adminToken();
    const roomId = await firstRoomId();
    const ok = await request(app)
      .put(`/api/rooms/${roomId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ capacity: 16 });
    expect(ok.status).toBe(200);
    expect(ok.body.capacity).toBe(16);

    const missing = await request(app)
      .put('/api/rooms/ghost')
      .set('Authorization', `Bearer ${token}`)
      .send({ capacity: 5 });
    expect(missing.status).toBe(404);
  });

  it('soft-deactivates a room; new bookings are rejected with 422', async () => {
    const token = await adminToken();
    const roomId = await firstRoomId();
    const del = await request(app)
      .delete(`/api/rooms/${roomId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(del.status).toBe(200);
    expect(del.body.active).toBe(false);

    const emp = await employeeToken();
    const booking = await bookThu(emp, roomId);
    expect(booking.status).toBe(422);
    expect(booking.body.error.code).toBe('RULE_VIOLATION');
  });
});

// ---------------------------------------------------------------------------
describe('availability endpoint', () => {
  it('returns an 11-slot free/busy grid for a day', async () => {
    const token = await employeeToken();
    const roomId = await firstRoomId();
    const empty = await request(app)
      .get(`/api/rooms/${roomId}/availability?date=${THU}`)
      .set('Authorization', `Bearer ${token}`);
    expect(empty.status).toBe(200);
    expect(empty.body.slots).toHaveLength(11);
    expect(empty.body.slots.every((s: { status: string }) => s.status === 'free')).toBe(true);

    await bookThu(token, roomId, '14:00'); // 14:00–15:00 → exactly one busy slot
    const busy = await request(app)
      .get(`/api/rooms/${roomId}/availability?date=${THU}`)
      .set('Authorization', `Bearer ${token}`);
    expect(busy.body.slots.filter((s: { status: string }) => s.status === 'busy')).toHaveLength(1);
  });

  it('requires a date (400) and a real room (404)', async () => {
    const token = await employeeToken();
    const roomId = await firstRoomId();
    const noDate = await request(app)
      .get(`/api/rooms/${roomId}/availability`)
      .set('Authorization', `Bearer ${token}`);
    expect(noDate.status).toBe(400);

    const badRoom = await request(app)
      .get('/api/rooms/ghost/availability?date=2026-08-27')
      .set('Authorization', `Bearer ${token}`);
    expect(badRoom.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
describe('booking endpoints', () => {
  it('creates a booking (201, single occurrence)', async () => {
    const token = await employeeToken();
    const roomId = await firstRoomId();
    const res = await bookThu(token, roomId);
    expect(res.status).toBe(201);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ status: 'confirmed', roomName: expect.any(String) });
  });

  it('creates a weekly recurrence with count occurrences', async () => {
    const token = await employeeToken();
    const roomId = await firstRoomId();
    const res = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        roomId,
        title: 'Weekly standup',
        start: startIso('09:00'),
        durationMinutes: 30,
        attendees: 3,
        recurrence: { kind: 'weekly', count: 3 },
      });
    expect(res.status).toBe(201);
    expect(res.body).toHaveLength(3);
  });

  it('rejects an overlapping booking with 409 ROOM_CONFLICT', async () => {
    const token = await employeeToken();
    const roomId = await firstRoomId();
    await bookThu(token, roomId);
    const res = await bookThu(token, roomId, '14:30');
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ROOM_CONFLICT');
  });

  it('rejects weekend and after-hours bookings with 422', async () => {
    const token = await employeeToken();
    const roomId = await firstRoomId();
    const weekend = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        roomId,
        title: 'Weekend',
        start: local(2026, 8, 29, 10, 0).toISOString(),
        durationMinutes: 60,
        attendees: 2,
        recurrence: { kind: 'none' },
      });
    expect(weekend.status).toBe(422);

    const late = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        roomId,
        title: 'Late',
        start: local(2026, 8, 27, 18, 30).toISOString(),
        durationMinutes: 60,
        attendees: 2,
        recurrence: { kind: 'none' },
      });
    expect(late.status).toBe(422);
    expect(late.body.error.code).toBe('RULE_VIOLATION');
  });

  it('rejects attendees over capacity with 422', async () => {
    const token = await employeeToken();
    const roomId = await firstRoomId();
    const res = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        roomId,
        title: 'Too big',
        start: startIso('15:00'),
        durationMinutes: 30,
        attendees: 999,
        recurrence: { kind: 'none' },
      });
    expect(res.status).toBe(422);
    expect(res.body.error.message).toContain('capacity');
  });

  it('validates booking bodies (400 for bad duration)', async () => {
    const token = await employeeToken();
    const roomId = await firstRoomId();
    const res = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        roomId,
        title: 'Odd',
        start: startIso('15:00'),
        durationMinutes: 45,
        attendees: 2,
        recurrence: { kind: 'none' },
      });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('lists own bookings via /mine and scopes /bookings for employees', async () => {
    const token = await employeeToken();
    const roomId = await firstRoomId();
    await bookThu(token, roomId);
    const mine = await request(app)
      .get('/api/bookings/mine')
      .set('Authorization', `Bearer ${token}`);
    expect(mine.status).toBe(200);
    expect(mine.body).toHaveLength(1);

    const other = await registerEmployee('ada@example.com', 'anotherpass');
    const all = await request(app)
      .get('/api/bookings')
      .set('Authorization', `Bearer ${other.body.token}`);
    expect(all.body).toHaveLength(0);
  });

  it('lets admins list all bookings with date/room filters', async () => {
    const token = await adminToken();
    const emp = await employeeToken();
    const roomId = await firstRoomId();
    await bookThu(emp, roomId);
    const all = await request(app).get('/api/bookings').set('Authorization', `Bearer ${token}`);
    expect(all.body).toHaveLength(1);

    const byRoom = await request(app)
      .get(`/api/bookings?roomId=${roomId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(byRoom.body).toHaveLength(1);

    const byDate = await request(app)
      .get(`/api/bookings?date=${THU}`)
      .set('Authorization', `Bearer ${token}`);
    expect(byDate.body).toHaveLength(1);

    const wrongDay = await request(app)
      .get('/api/bookings?date=2026-08-28')
      .set('Authorization', `Bearer ${token}`);
    expect(wrongDay.body).toHaveLength(0);
  });

  it('marks completed bookings on read once the end has passed', async () => {
    const token = await employeeToken();
    const roomId = await firstRoomId();
    NOW.value = local(2026, 8, 27, 8, 0); // before start
    const created = await bookThu(token, roomId, '09:00');
    const bookingId = created.body[0].id as string;
    NOW.value = local(2026, 8, 27, 10, 0); // after end → completed
    const mine = await request(app)
      .get('/api/bookings/mine')
      .set('Authorization', `Bearer ${token}`);
    expect(mine.body[0]).toMatchObject({ id: bookingId, status: 'completed' });
  });

  it('enforces the cancellation window over HTTP', async () => {
    const token = await employeeToken();
    const roomId = await firstRoomId();
    const created = await bookThu(token, roomId);
    const bookingId = created.body[0].id as string;

    // 3h55 before start → allowed
    NOW.value = local(2026, 8, 27, 10, 5);
    const ok = await request(app)
      .delete(`/api/bookings/${bookingId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(ok.status).toBe(200);
    expect(ok.body.status).toBe('cancelled');

    // window closed → 422
    NOW.value = local(2026, 8, 25, 10, 0);
    const again = await bookThu(token, roomId, '11:00');
    const id2 = again.body[0].id as string;
    NOW.value = local(2026, 8, 27, 10, 45); // 15 min before 11:00
    const late = await request(app)
      .delete(`/api/bookings/${id2}`)
      .set('Authorization', `Bearer ${token}`);
    expect(late.status).toBe(422);
    expect(late.body.error.code).toBe('RULE_VIOLATION');
  });

  it('forbids non-organizers from cancelling (403) and admins can cancel anytime', async () => {
    const token = await employeeToken();
    const roomId = await firstRoomId();
    const created = await bookThu(token, roomId);
    const bookingId = created.body[0].id as string;

    const intruder = await registerEmployee('intruder@example.com', 'anotherpass');
    const forbidden = await request(app)
      .delete(`/api/bookings/${bookingId}`)
      .set('Authorization', `Bearer ${intruder.body.token}`);
    expect(forbidden.status).toBe(403);

    // Admin may cancel minutes before start.
    const adminTok = await adminToken();
    const adminCancel = await request(app)
      .delete(`/api/bookings/${bookingId}`)
      .set('Authorization', `Bearer ${adminTok}`);
    expect(adminCancel.status).toBe(200);

    // Already-cancelled → 409
    const twice = await request(app)
      .delete(`/api/bookings/${bookingId}`)
      .set('Authorization', `Bearer ${adminTok}`);
    expect(twice.status).toBe(409);
  });
});

// ---------------------------------------------------------------------------
describe('users/me/password', () => {
  it('changes the password; the old one stops working', async () => {
    const token = await employeeToken();
    const change = await request(app)
      .put('/api/users/me/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'supersecret', newPassword: 'brandnew123' });
    expect(change.status).toBe(200);

    const oldLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'grace@example.com', password: 'supersecret' });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'grace@example.com', password: 'brandnew123' });
    expect(newLogin.status).toBe(200);
  });

  it('rejects a wrong current password (401) and short new password (400)', async () => {
    const token = await employeeToken();
    const wrong = await request(app)
      .put('/api/users/me/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'nope', newPassword: 'brandnew123' });
    expect(wrong.status).toBe(401);

    const short = await request(app)
      .put('/api/users/me/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'supersecret', newPassword: 'tiny' });
    expect(short.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
describe('admin/usage', () => {
  it('returns a per-room usage report for admins', async () => {
    const adminTok = await adminToken();
    const emp = await employeeToken();
    const roomId = await firstRoomId();
    await bookThu(emp, roomId); // 1h
    const roomsRes = await request(app).get('/api/rooms').set('Authorization', `Bearer ${emp}`);
    const bookedName = (roomsRes.body as Room[]).find((r) => r.id === roomId)!.name;

    const res = await request(app)
      .get('/api/admin/usage?from=2026-08-01&to=2026-08-31')
      .set('Authorization', `Bearer ${adminTok}`);
    expect(res.status).toBe(200);
    expect(res.body.rooms).toHaveLength(6);
    const row = res.body.rooms.find((r: { roomName: string }) => r.roomName === bookedName);
    expect(row.bookedHours).toBe(1);
    expect(row.bookings).toBe(1);
    expect(row.topOrganizer.email).toBe('grace@example.com');
  });

  it('forbids employees (403) and unauthenticated callers (401)', async () => {
    const emp = await employeeToken();
    const forbidden = await request(app)
      .get('/api/admin/usage')
      .set('Authorization', `Bearer ${emp}`);
    expect(forbidden.status).toBe(403);

    const anon = await request(app).get('/api/admin/usage');
    expect(anon.status).toBe(401);
  });

  it('validates the range (400 when from > to)', async () => {
    const adminTok = await adminToken();
    const res = await request(app)
      .get('/api/admin/usage?from=2026-08-31&to=2026-08-01')
      .set('Authorization', `Bearer ${adminTok}`);
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
describe('api docs + unknown routes', () => {
  it('serves Swagger UI at /api-docs', async () => {
    const res = await request(app).get('/api-docs/');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
  });

  it('returns a JSON 404 for unknown API routes', async () => {
    const res = await request(app).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
