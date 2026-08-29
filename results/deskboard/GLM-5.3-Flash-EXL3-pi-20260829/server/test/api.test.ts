/** HTTP integration tests: fresh app per test, real requests via supertest. */
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import {
  MONDAY,
  adminToken,
  createBooking,
  createRoom,
  makeHarness,
  registerAndLogin,
} from './helpers.js';

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

describe('GET /health', () => {
  it('returns 200 ok', async () => {
    const { app } = makeHarness();
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('POST /api/auth/register', () => {
  it('registers an employee and returns a token', async () => {
    const { app } = makeHarness();
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Ana', email: 'ana@example.com', password: 'password123' });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.role).toBe('employee');
  });

  it('rejects duplicate registration with 409', async () => {
    const { app } = makeHarness();
    await request(app).post('/api/auth/register').send({ name: 'Ana', email: 'ana@example.com', password: 'password123' });
    const res = await request(app).post('/api/auth/register').send({ name: 'Ana', email: 'ana@example.com', password: 'password123' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('rejects invalid payloads with 400 and field details', async () => {
    const { app } = makeHarness();
    const res = await request(app).post('/api/auth/register').send({ name: '', email: 'not-an-email', password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
    expect(res.body.error.details).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'email' })]));
  });
});

describe('POST /api/auth/login', () => {
  it('logs in the seeded admin', async () => {
    const { app } = makeHarness();
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@deskboard.local', password: 'admin123' });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('admin');
  });

  it('rejects wrong credentials with 401', async () => {
    const { app } = makeHarness();
    const res = await request(app).post('/api/auth/login').send({ email: 'admin@deskboard.local', password: 'nope' });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/auth/me', () => {
  it('returns the profile for a valid token', async () => {
    const { app } = makeHarness();
    const { token } = await registerAndLogin(app);
    const res = await request(app).get('/api/auth/me').set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.email).toContain('@example.com');
  });

  it('returns 401 without a token and with a garbage token', async () => {
    const { app } = makeHarness();
    expect((await request(app).get('/api/auth/me')).status).toBe(401);
    expect((await request(app).get('/api/auth/me').set(auth('garbage'))).status).toBe(401);
  });
});

describe('Rooms API', () => {
  it('requires auth even for listing (public within the app)', async () => {
    const { app } = makeHarness();
    expect((await request(app).get('/api/rooms')).status).toBe(401);
  });

  it('seeds default rooms visible after login', async () => {
    const { app } = makeHarness();
    const token = await adminToken(app);
    const res = await request(app).get('/api/rooms').set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(5);
    expect(res.body[0]).toMatchObject({ active: true });
  });

  it('lets admins create and update rooms; employees get 403', async () => {
    const { app } = makeHarness();
    const admin = await adminToken(app);
    const employee = (await registerAndLogin(app)).token;

    expect((await request(app).post('/api/rooms').set(auth(employee)).send({ name: 'N', capacity: 4, floor: 1, features: [] })).status).toBe(403);

    const created = await request(app).post('/api/rooms').set(auth(admin)).send({ name: 'Lab', capacity: 6, floor: 4, features: ['screen'] });
    expect(created.status).toBe(201);
    expect(created.body.active).toBe(true);

    const updated = await request(app).put(`/api/rooms/${created.body.id}`).set(auth(admin)).send({ capacity: 8 });
    expect(updated.status).toBe(200);
    expect(updated.body.capacity).toBe(8);
  });

  it('rejects duplicate room names with 409', async () => {
    const { app } = makeHarness();
    const admin = await adminToken(app);
    await createRoom(app, admin, 'Dup Room');
    const res = await request(app).post('/api/rooms').set(auth(admin)).send({ name: 'dup room', capacity: 4, floor: 1, features: [] });
    expect(res.status).toBe(409);
  });

  it('validates room payloads with 400 (capacity out of range)', async () => {
    const { app } = makeHarness();
    const admin = await adminToken(app);
    const res = await request(app).post('/api/rooms').set(auth(admin)).send({ name: 'Bad', capacity: 200, floor: 1, features: [] });
    expect(res.status).toBe(400);
  });

  it('deactivates a room on DELETE (soft) and hides new bookings but not the room', async () => {
    const { app } = makeHarness();
    const admin = await adminToken(app);
    const roomId = await createRoom(app, admin, 'Doomed');
    const del = await request(app).delete(`/api/rooms/${roomId}`).set(auth(admin));
    expect(del.status).toBe(200);
    expect(del.body.active).toBe(false);

    const employee = (await registerAndLogin(app)).token;
    const booking = await createBooking(app, employee, {
      roomId, title: 'Blocked', start: `${MONDAY}T09:00`, end: `${MONDAY}T10:00`, attendees: 1,
    });
    expect(booking.status).toBe(422);
  });

  it('returns the availability grid for a date', async () => {
    const { app } = makeHarness();
    const admin = await adminToken(app);
    const roomId = await createRoom(app, admin, 'Grid Room');
    const employee = (await registerAndLogin(app)).token;
    await createBooking(app, employee, {
      roomId, title: 'Slot', start: `${MONDAY}T09:00`, end: `${MONDAY}T10:00`, attendees: 1,
    });
    const res = await request(app).get(`/api/rooms/${roomId}/availability?date=${MONDAY}`).set(auth(admin));
    expect(res.status).toBe(200);
    expect(res.body.slots).toHaveLength(11);
    expect(res.body.slots[1].bookingTitle).toBe('Slot');
  });

  it('400s on a malformed availability date', async () => {
    const { app } = makeHarness();
    const admin = await adminToken(app);
    const roomId = await createRoom(app, admin);
    const res = await request(app).get(`/api/rooms/${roomId}/availability?date=nope`).set(auth(admin));
    expect(res.status).toBe(400);
  });
});

describe('Bookings API', () => {
  it('creates a booking and returns 201 with computed view fields', async () => {
    const { app } = makeHarness();
    const admin = await adminToken(app);
    const employee = await registerAndLogin(app);
    const roomId = await createRoom(app, admin);
    const res = await createBooking(app, employee.token, {
      roomId, title: 'Kickoff', start: `${MONDAY}T09:00`, end: `${MONDAY}T10:00`, attendees: 3,
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ title: 'Kickoff', organizerName: 'Test User', status: 'confirmed', roomName: 'Room X' });
    expect(res.body.occurrences).toHaveLength(1);
  });

  it('returns 409 ROOM_CONFLICT on overlap and allows back-to-back', async () => {
    const { app } = makeHarness();
    const admin = await adminToken(app);
    const employee = await registerAndLogin(app);
    const roomId = await createRoom(app, admin);
    await createBooking(app, employee.token, {
      roomId, title: 'A', start: `${MONDAY}T09:00`, end: `${MONDAY}T10:00`, attendees: 1,
    });
    const overlap = await createBooking(app, employee.token, {
      roomId, title: 'B', start: `${MONDAY}T09:30`, end: `${MONDAY}T10:30`, attendees: 1,
    });
    expect(overlap.status).toBe(409);
    expect(overlap.body.error.code).toBe('ROOM_CONFLICT');
    const adjacent = await createBooking(app, employee.token, {
      roomId, title: 'C', start: `${MONDAY}T10:00`, end: `${MONDAY}T11:00`, attendees: 1,
    });
    expect(adjacent.status).toBe(201);
  });

  it('returns 422 for over-capacity, outside business hours, and bad durations', async () => {
    const { app } = makeHarness();
    const admin = await adminToken(app);
    const employee = await registerAndLogin(app);
    const roomId = await createRoom(app, admin);

    expect(
      (await createBooking(app, employee.token, {
        roomId, title: 'Crowd', start: `${MONDAY}T09:00`, end: `${MONDAY}T10:00`, attendees: 99,
      })).status,
    ).toBe(422);
    expect(
      (await createBooking(app, employee.token, {
        roomId, title: 'Early', start: `${MONDAY}T06:00`, end: `${MONDAY}T07:00`, attendees: 1,
      })).status,
    ).toBe(422);
    expect(
      (await createBooking(app, employee.token, {
        roomId, title: 'Long', start: `${MONDAY}T09:00`, end: `${MONDAY}T14:00`, attendees: 1,
      })).status,
    ).toBe(422);
    expect(
      (await createBooking(app, employee.token, {
        roomId, title: 'Inverted', start: `${MONDAY}T10:00`, end: `${MONDAY}T09:00`, attendees: 1,
      })).status,
    ).toBe(422);
  });

  it('validates booking payloads with 400 (missing title, bad datetime)', async () => {
    const { app } = makeHarness();
    const admin = await adminToken(app);
    const employee = await registerAndLogin(app);
    const roomId = await createRoom(app, admin);
    const res = await createBooking(app, employee.token, { roomId, start: 'not-a-date', end: `${MONDAY}T10:00`, attendees: 1 });
    expect(res.status).toBe(400);
  });

  it('expands weekly recurrence and rejects on any occurrence conflict', async () => {
    const { app } = makeHarness();
    const admin = await adminToken(app);
    const employee = await registerAndLogin(app);
    const roomId = await createRoom(app, admin);

    const series = await createBooking(app, employee.token, {
      roomId, title: 'Series', start: `${MONDAY}T09:00`, end: `${MONDAY}T10:00`, attendees: 1, recurrence: { kind: 'weekly', count: 4 },
    });
    expect(series.status).toBe(201);
    expect(series.body.occurrences).toHaveLength(4);

    const clash = await createBooking(app, employee.token, {
      roomId, title: 'Clash', start: '2026-09-21T09:30', end: '2026-09-21T10:30', attendees: 1,
    });
    expect(clash.status).toBe(409);
  });

  it('GET /api/bookings/mine returns only own bookings', async () => {
    const { app } = makeHarness();
    const admin = await adminToken(app);
    const employee = await registerAndLogin(app);
    const roomId = await createRoom(app, admin);
    await createBooking(app, employee.token, {
      roomId, title: 'Mine', start: `${MONDAY}T09:00`, end: `${MONDAY}T10:00`, attendees: 1,
    });
    await createBooking(app, admin, {
      roomId, title: 'Admins own', start: `${MONDAY}T11:00`, end: `${MONDAY}T12:00`, attendees: 1,
    });
    const res = await request(app).get('/api/bookings/mine').set(auth(employee.token));
    expect(res.body.map((b: { title: string }) => b.title)).toEqual(['Mine']);
  });

  it('GET /api/bookings is role-scoped and filterable by date and room', async () => {
    const { app } = makeHarness();
    const admin = await adminToken(app);
    const employee = await registerAndLogin(app);
    const roomId = await createRoom(app, admin);
    await createBooking(app, employee.token, {
      roomId, title: 'Mon', start: `${MONDAY}T09:00`, end: `${MONDAY}T10:00`, attendees: 1,
    });
    await createBooking(app, employee.token, {
      roomId, title: 'Tue', start: '2026-09-01T09:00', end: '2026-09-01T10:00', attendees: 1,
    });

    const employeeView = await request(app).get('/api/bookings').set(auth(employee.token));
    expect(employeeView.body).toHaveLength(2); // employee sees only own

    const adminAll = await request(app).get('/api/bookings').set(auth(admin));
    expect(adminAll.body).toHaveLength(2);

    const byDate = await request(app).get(`/api/bookings?date=${MONDAY}`).set(auth(admin));
    expect(byDate.body.map((b: { title: string }) => b.title)).toEqual(['Mon']);

    const byRoom = await request(app).get(`/api/bookings?roomId=${roomId}&date=2026-09-01`).set(auth(admin));
    expect(byRoom.body.map((b: { title: string }) => b.title)).toEqual(['Tue']);
  });

  it('DELETE /api/bookings/:id enforces the cancellation window (422) and ownership (403)', async () => {
    const { app } = makeHarness();
    const admin = await adminToken(app);
    const a = await registerAndLogin(app);
    const b = await registerAndLogin(app);
    const roomId = await createRoom(app, admin);

    const soon = await createBooking(app, a.token, {
      roomId, title: 'Soon', start: `${MONDAY}T08:30`, end: `${MONDAY}T09:30`, attendees: 1,
    });
    // Fixed clock is Monday 08:00 → inside the 1h window → 422.
    const selfCancel = await request(app).delete(`/api/bookings/${soon.body.id}`).set(auth(a.token));
    expect(selfCancel.status).toBe(422);

    // Someone else with plenty of time still gets 403.
    const later = await createBooking(app, a.token, {
      roomId, title: 'Later', start: `${MONDAY}T14:00`, end: `${MONDAY}T15:00`, attendees: 1,
    });
    expect((await request(app).delete(`/api/bookings/${later.body.id}`).set(auth(b.token))).status).toBe(403);
    // Admin can cancel anytime.
    expect((await request(app).delete(`/api/bookings/${later.body.id}`).set(auth(admin))).status).toBe(200);
    // Unknown id → 404.
    expect((await request(app).delete('/api/bookings/missing').set(auth(admin))).status).toBe(404);
  });

  it('marks past bookings as completed on read without mutating history', async () => {
    const { app, clock } = makeHarness();
    const admin = await adminToken(app);
    const employee = await registerAndLogin(app);
    const roomId = await createRoom(app, admin);
    await createBooking(app, employee.token, {
      roomId, title: 'Past', start: `${MONDAY}T09:00`, end: `${MONDAY}T10:00`, attendees: 1,
    });
    clock.set('2026-08-31T12:00:00');
    const res = await request(app).get('/api/bookings/mine').set(auth(employee.token));
    expect(res.body[0].status).toBe('completed');
  });
});

describe('PUT /api/users/me/password', () => {
  it('changes the password and invalidates the old one', async () => {
    const { app } = makeHarness();
    const { token } = await registerAndLogin(app, { email: 'pw@example.com' });
    const res = await request(app)
      .put('/api/users/me/password')
      .set(auth(token))
      .send({ currentPassword: 'password123', newPassword: 'brand-new-pw' });
    expect(res.status).toBe(204);

    expect(
      (await request(app).post('/api/auth/login').send({ email: 'pw@example.com', password: 'password123' })).status,
    ).toBe(401);
    expect(
      (await request(app).post('/api/auth/login').send({ email: 'pw@example.com', password: 'brand-new-pw' })).status,
    ).toBe(200);
  });

  it('rejects a wrong current password with 400', async () => {
    const { app } = makeHarness();
    const { token } = await registerAndLogin(app);
    const res = await request(app)
      .put('/api/users/me/password')
      .set(auth(token))
      .send({ currentPassword: 'wrong', newPassword: 'brand-new-pw' });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/admin/usage', () => {
  it('is admin-only (403 for employees)', async () => {
    const { app } = makeHarness();
    const employee = await registerAndLogin(app);
    const res = await request(app).get('/api/admin/usage?from=2026-08-31&to=2026-09-06').set(auth(employee.token));
    expect(res.status).toBe(403);
  });

  it('returns per-room usage for admins', async () => {
    const { app } = makeHarness();
    const admin = await adminToken(app);
    const employee = await registerAndLogin(app);
    const roomId = await createRoom(app, admin, 'Usage Room');
    await createBooking(app, employee.token, {
      roomId, title: 'Usage', start: `${MONDAY}T09:00`, end: `${MONDAY}T11:00`, attendees: 1,
    });
    const res = await request(app).get('/api/admin/usage?from=2026-08-31&to=2026-09-06').set(auth(admin));
    expect(res.status).toBe(200);
    const entry = res.body.find((r: { roomId: string }) => r.roomId === roomId);
    expect(entry).toMatchObject({ roomName: 'Usage Room', totalBookedMinutes: 120, bookingCount: 1, topOrganizer: 'Test User' });
  });

  it('400s on missing query params', async () => {
    const { app } = makeHarness();
    const admin = await adminToken(app);
    expect((await request(app).get('/api/admin/usage').set(auth(admin))).status).toBe(400);
  });
});

describe('error contract & unknown routes', () => {
  it('wraps unknown API endpoints in the shared error envelope', async () => {
    const { app } = makeHarness();
    const token = await adminToken(app);
    const res = await request(app).get('/api/unknown').set(auth(token));
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: 'NOT_FOUND', message: 'Unknown API endpoint' } });
  });

  it('never leaks internal details in error messages', async () => {
    const { app } = makeHarness();
    const res = await request(app).post('/api/auth/login').send({ email: 'x@y.z', password: 'nope' });
    expect(JSON.stringify(res.body)).not.toMatch(/stack|at .*\(/);
  });
});
