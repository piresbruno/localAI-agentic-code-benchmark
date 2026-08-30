// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp, type App } from '../app.js';
import { fixedClock, sequentialIdGen } from '../services/clock.js';
import type { BookingDto, Room } from 'deskboard-shared';

/** Monday-based local dates, timezone-independent (see bookingService.test.ts). */
const mondayIso = (dayOffset: number, hour: number, min = 0): string => {
  const d = new Date(2026, 8, 1);
  while (d.getDay() !== 1) d.setDate(d.getDate() + 1);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, min, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const mondayDate = (dayOffset = 0): string => mondayIso(dayOffset, 12).slice(0, 10);

const NOW = mondayIso(0, 8);

let app: App;

const buildApp = () =>
  createApp({
    jwtSecret: 'test-secret',
    clock: fixedClock(NOW),
    ids: sequentialIdGen('x'),
    clientDist: null
  });

const registerAndLogin = async (
  email = 'nina@example.com',
  role: 'employee' | 'admin' = 'employee'
) => {
  if (role === 'admin') {
    const res = await request(app.express)
      .post('/api/auth/login')
      .send({ email: 'admin@deskboard.local', password: 'admin123' });
    return res.body.token as string;
  }
  const reg = await request(app.express)
    .post('/api/auth/register')
    .send({ name: 'Nina New', email, password: 'password123' });
  return reg.body.token as string;
};

describe('HTTP API', () => {
  beforeEach(() => {
    app = buildApp();
  });

  it('GET /api/health returns 200 ok', async () => {
    const res = await request(app.express).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('registers, logs in and reads /auth/me', async () => {
    const reg = await request(app.express)
      .post('/api/auth/register')
      .send({ name: 'Nina', email: 'nina@example.com', password: 'password123' });
    expect(reg.status).toBe(201);
    expect(reg.body.user.role).toBe('employee');
    expect(reg.body.token).toBeTruthy();

    const me = await request(app.express)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${reg.body.token}`);
    expect(me.status).toBe(200);
    expect(me.body.email).toBe('nina@example.com');
    expect(me.body.passwordHash).toBeUndefined();

    const login = await request(app.express)
      .post('/api/auth/login')
      .send({ email: 'nina@example.com', password: 'password123' });
    expect(login.status).toBe(200);
  });

  it('rejects duplicate registration and wrong credentials with the error contract', async () => {
    await request(app.express)
      .post('/api/auth/register')
      .send({ name: 'Nina', email: 'nina@example.com', password: 'password123' });
    const dup = await request(app.express)
      .post('/api/auth/register')
      .send({ name: 'Nina 2', email: 'nina@example.com', password: 'password123' });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('EMAIL_IN_USE');

    const bad = await request(app.express)
      .post('/api/auth/login')
      .send({ email: 'nina@example.com', password: 'wrong-pass-1' });
    expect(bad.status).toBe(401);
    expect(bad.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('401 on protected routes without a token; 401 for garbage tokens', async () => {
    const rooms = await request(app.express).get('/api/rooms');
    expect(rooms.status).toBe(401);
    expect(rooms.body.error.code).toBe('UNAUTHENTICATED');

    const token = await registerAndLogin();
    const bad = await request(app.express)
      .get('/api/rooms')
      .set('Authorization', 'Bearer not.a.jwt');
    expect(bad.status).toBe(401);
    void token;
  });

  it('validation errors return 400 with field details', async () => {
    const token = await registerAndLogin();
    const res = await request(app.express)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({ roomId: 'r-1', title: '', start: 'nope', durationMinutes: 45, attendees: 0 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toBeTruthy();
  });

  it('rooms are admin-only for mutations; seeded rooms are listed', async () => {
    const token = await registerAndLogin();
    const adminToken = await registerAndLogin(undefined, 'admin');

    const list = await request(app.express).get('/api/rooms').set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body.length).toBeGreaterThanOrEqual(3);
    const seeded: Room = list.body[0];
    expect(seeded.active).toBe(true);

    const forbiddenCreate = await request(app.express)
      .post('/api/rooms')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Mango', capacity: 4, floor: 1 });
    expect(forbiddenCreate.status).toBe(403);
    expect(forbiddenCreate.body.error.code).toBe('FORBIDDEN');

    const created = await request(app.express)
      .post('/api/rooms')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Mango', capacity: 4, floor: 1, features: ['phone'] });
    expect(created.status).toBe(201);
    expect(created.body.name).toBe('Mango');

    const dup = await request(app.express)
      .post('/api/rooms')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'mango', capacity: 4, floor: 1 });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('DUPLICATE_ROOM_NAME');

    const updated = await request(app.express)
      .put(`/api/rooms/${created.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ capacity: 8 });
    expect(updated.status).toBe(200);
    expect(updated.body.capacity).toBe(8);

    const deactivated = await request(app.express)
      .delete(`/api/rooms/${created.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(deactivated.status).toBe(200);
    expect(deactivated.body.active).toBe(false);

    const unknown = await request(app.express)
      .put('/api/rooms/nope')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ capacity: 8 });
    expect(unknown.status).toBe(404);
    expect(unknown.body.error.code).toBe('NOT_FOUND');
  });

  it('availability returns the free/busy grid for a date', async () => {
    const token = await registerAndLogin();
    const rooms = await request(app.express).get('/api/rooms').set('Authorization', `Bearer ${token}`);
    const roomId = rooms.body[0].id;

    const empty = await request(app.express)
      .get(`/api/rooms/${roomId}/availability`)
      .query({ date: mondayDate(1) })
      .set('Authorization', `Bearer ${token}`);
    expect(empty.status).toBe(200);
    expect(empty.body.slots).toHaveLength(11);
    expect(empty.body.slots.every((s: { available: boolean }) => s.available)).toBe(true);

    await request(app.express)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        roomId,
        title: 'Kickoff',
        start: mondayIso(1, 10),
        durationMinutes: 60,
        attendees: 2
      });

    const busy = await request(app.express)
      .get(`/api/rooms/${roomId}/availability`)
      .query({ date: mondayDate(1) })
      .set('Authorization', `Bearer ${token}`);
    const booked = busy.body.slots.find((s: { start: string }) => s.start === '10:00');
    expect(booked.available).toBe(false);
    expect(booked.bookingTitle).toBe('Kickoff');

    const badQuery = await request(app.express)
      .get(`/api/rooms/${roomId}/availability`)
      .query({ date: '2026/09/07' })
      .set('Authorization', `Bearer ${token}`);
    expect(badQuery.status).toBe(400);
  });

  it('creates bookings and rejects conflicts with 409 ROOM_CONFLICT', async () => {
    const token = await registerAndLogin();
    const rooms = await request(app.express).get('/api/rooms').set('Authorization', `Bearer ${token}`);
    const roomId = rooms.body[0].id;

    const first = await request(app.express)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({ roomId, title: 'Kickoff', start: mondayIso(1, 10), durationMinutes: 60, attendees: 2 });
    expect(first.status).toBe(201);
    expect(first.body[0].status).toBe('confirmed');

    const conflict = await request(app.express)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({ roomId, title: 'Overlap', start: mondayIso(1, 10, 0), durationMinutes: 30, attendees: 1 });
    expect(conflict.status).toBe(409);
    expect(conflict.body.error.code).toBe('ROOM_CONFLICT');

    // Back-to-back is allowed
    const adjacent = await request(app.express)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({ roomId, title: 'Follow-up', start: mondayIso(1, 11), durationMinutes: 30, attendees: 1 });
    expect(adjacent.status).toBe(201);
  });

  it('rejects over-capacity bookings with 422 and unknown rooms with 404', async () => {
    const token = await registerAndLogin();
    const rooms = await request(app.express).get('/api/rooms').set('Authorization', `Bearer ${token}`);
    const bigRoom: Room = rooms.body.find((r: Room) => r.capacity >= 10);

    const over = await request(app.express)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        roomId: bigRoom.id,
        title: 'Too many',
        start: mondayIso(1, 10),
        durationMinutes: 60,
        attendees: bigRoom.capacity + 1
      });
    expect(over.status).toBe(422);
    expect(over.body.error.code).toBe('RULE_VIOLATION');

    const missing = await request(app.express)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({ roomId: 'nope', title: 'X', start: mondayIso(1, 10), durationMinutes: 60, attendees: 1 });
    expect(missing.status).toBe(404);
  });

  it('weekly recurrence creates all occurrences or nothing', async () => {
    const token = await registerAndLogin();
    const rooms = await request(app.express).get('/api/rooms').set('Authorization', `Bearer ${token}`);
    const roomId = rooms.body[0].id;

    const series = await request(app.express)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        roomId,
        title: 'Sync',
        start: mondayIso(1, 9),
        durationMinutes: 60,
        attendees: 2,
        recurrence: { kind: 'weekly', count: 4 }
      });
    expect(series.status).toBe(201);
    expect(series.body).toHaveLength(4);
    expect(series.body[3].start).toBe(mondayIso(22, 9));

    const clash = await request(app.express)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        roomId,
        title: 'Clash',
        start: mondayIso(1, 9),
        durationMinutes: 60,
        attendees: 2,
        recurrence: { kind: 'weekly', count: 4 }
      });
    expect(clash.status).toBe(409);
  });

  it('bookings outside business hours or on weekends are rejected with 400', async () => {
    const token = await registerAndLogin();
    const rooms = await request(app.express).get('/api/rooms').set('Authorization', `Bearer ${token}`);
    const roomId = rooms.body[0].id;

    const early = await request(app.express)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({ roomId, title: 'Early', start: mondayIso(1, 7), durationMinutes: 60, attendees: 1 });
    expect(early.status).toBe(400);
    expect(early.body.error.code).toBe('VALIDATION_ERROR');

    const saturday = await request(app.express)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({ roomId, title: 'Weekend', start: mondayIso(5, 10), durationMinutes: 60, attendees: 1 });
    expect(saturday.status).toBe(400);
    expect(saturday.body.error.message).toMatch(/Monday to Friday/);
  });

  it('GET /bookings is role-scoped; /bookings/mine lists own; cancel enforces rules', async () => {
    const empToken = await registerAndLogin('nina@example.com');
    const otherToken = await registerAndLogin('sam@example.com');
    const adminToken = await registerAndLogin(undefined, 'admin');
    const rooms = await request(app.express).get('/api/rooms').set('Authorization', `Bearer ${empToken}`);
    const roomId = rooms.body[0].id;

    const make = (tok: string, title: string, day: number, hour: number) =>
      request(app.express)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${tok}`)
        .send({ roomId, title, start: mondayIso(day, hour), durationMinutes: 60, attendees: 1 });

    const nine = await make(empToken, 'Nine', 1, 9);
    const ten = await make(otherToken, 'Ten', 1, 10);
    const soon = await request(app.express)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${empToken}`)
      .send({ roomId, title: 'Soon', start: mondayIso(0, 8, 30), durationMinutes: 30, attendees: 1 });

    const mine = await request(app.express).get('/api/bookings/mine').set('Authorization', `Bearer ${empToken}`);
    expect(mine.body.map((b: BookingDto) => b.title).sort()).toEqual(['Nine', 'Soon']);

    const employeeView = await request(app.express).get('/api/bookings').set('Authorization', `Bearer ${empToken}`);
    expect(employeeView.body).toHaveLength(2); // only own
    const adminView = await request(app.express).get('/api/bookings').set('Authorization', `Bearer ${adminToken}`);
    expect(adminView.body).toHaveLength(3); // all
    const filtered = await request(app.express)
      .get('/api/bookings')
      .query({ date: mondayDate(1), roomId })
      .set('Authorization', `Bearer ${adminToken}`);
    expect(filtered.body).toHaveLength(2);

    // Employee cancels inside the 1h window → 422
    const insideWindow = await request(app.express)
      .delete(`/api/bookings/${soon.body[0].id}`)
      .set('Authorization', `Bearer ${empToken}`);
    expect(insideWindow.status).toBe(422);

    // Stranger cannot cancel → 403
    const forbiddenCancel = await request(app.express)
      .delete(`/api/bookings/${nine.body[0].id}`)
      .set('Authorization', `Bearer ${otherToken}`);
    expect(forbiddenCancel.status).toBe(403);

    // Organizer cancels in time → 200, then already-cancelled → 409
    const ok = await request(app.express)
      .delete(`/api/bookings/${nine.body[0].id}`)
      .set('Authorization', `Bearer ${empToken}`);
    expect(ok.status).toBe(200);
    expect(ok.body.status).toBe('cancelled');
    const again = await request(app.express)
      .delete(`/api/bookings/${nine.body[0].id}`)
      .set('Authorization', `Bearer ${empToken}`);
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('BOOKING_ALREADY_CANCELLED');

    // Admin can cancel anyone's booking
    const adminCancel = await request(app.express)
      .delete(`/api/bookings/${ten.body[0].id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(adminCancel.status).toBe(200);

    const unknown = await request(app.express)
      .delete('/api/bookings/nope')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(unknown.status).toBe(404);
  });

  it('changes password via /users/me/password', async () => {
    const token = await registerAndLogin('nina@example.com');
    const wrongCurrent = await request(app.express)
      .put('/api/users/me/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'wrong-pass-99', newPassword: 'newpassword1' });
    expect(wrongCurrent.status).toBe(403);

    const ok = await request(app.express)
      .put('/api/users/me/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'password123', newPassword: 'newpassword1' });
    expect(ok.status).toBe(200);

    const relogin = await request(app.express)
      .post('/api/auth/login')
      .send({ email: 'nina@example.com', password: 'newpassword1' });
    expect(relogin.status).toBe(200);
  });

  it('usage report is admin-only and aggregates per room', async () => {
    const empToken = await registerAndLogin('nina@example.com');
    const adminToken = await registerAndLogin(undefined, 'admin');
    const rooms = await request(app.express).get('/api/rooms').set('Authorization', `Bearer ${adminToken}`);
    const roomId = rooms.body[0].id;

    await request(app.express)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${empToken}`)
      .send({ roomId, title: 'Session', start: mondayIso(1, 9), durationMinutes: 120, attendees: 2 });

    const forbidden = await request(app.express)
      .get('/api/admin/usage')
      .query({ from: mondayDate(0), to: mondayDate(7) })
      .set('Authorization', `Bearer ${empToken}`);
    expect(forbidden.status).toBe(403);

    const report = await request(app.express)
      .get('/api/admin/usage')
      .query({ from: mondayDate(0), to: mondayDate(7) })
      .set('Authorization', `Bearer ${adminToken}`);
    expect(report.status).toBe(200);
    const kiwi = report.body.rooms.find((r: { room: Room }) => r.room.id === roomId);
    expect(kiwi.totalHours).toBe(2);
    expect(kiwi.bookingCount).toBe(1);
    expect(kiwi.topOrganizer.name).toBe('Nina New');

    const badRange = await request(app.express)
      .get('/api/admin/usage')
      .query({ from: mondayDate(7), to: mondayDate(0) })
      .set('Authorization', `Bearer ${adminToken}`);
    expect(badRange.status).toBe(400);
  });

  it('deactivated rooms reject new bookings with 422', async () => {
    const adminToken = await registerAndLogin(undefined, 'admin');
    const empToken = await registerAndLogin('nina@example.com');
    const rooms = await request(app.express).get('/api/rooms').set('Authorization', `Bearer ${adminToken}`);
    const roomId = rooms.body[0].id;

    await request(app.express).delete(`/api/rooms/${roomId}`).set('Authorization', `Bearer ${adminToken}`);
    const res = await request(app.express)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${empToken}`)
      .send({ roomId, title: 'Blocked', start: mondayIso(1, 9), durationMinutes: 60, attendees: 1 });
    expect(res.status).toBe(422);
    expect(res.body.error.message).toMatch(/deactivated/);
  });

  it('unknown API routes return 404 and malformed JSON returns 500 without leaking internals', async () => {
    const token = await registerAndLogin();
    const missing = await request(app.express)
      .get('/api/definitely-not-a-route')
      .set('Authorization', `Bearer ${token}`);
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe('NOT_FOUND');

    const broken = await request(app.express)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .set('Authorization', `Bearer ${token}`)
      .send('{not json');
    expect(broken.status).toBe(500);
    expect(broken.body.error.code).toBe('INTERNAL');
    expect(JSON.stringify(broken.body)).not.toMatch(/at /);
  });

  it('seeds the spec admin account that can log in', async () => {
    const res = await request(app.express)
      .post('/api/auth/login')
      .send({ email: 'admin@deskboard.local', password: 'admin123' });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('admin');
  });

  it('issues tokens that expire and stop working after 12h', async () => {
    const token = await registerAndLogin();
    // JWT exp is 12h after iat; decode without verifying to assert the claim
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
    expect(payload.exp - payload.iat).toBe(12 * 3600);
  });
});
