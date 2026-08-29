/**
 * OpenAPI 3.0 document for DeskBoard. Served at /api-docs via Swagger UI.
 * Written by hand to mirror the route wiring exactly; keep in sync with
 * http/*-routes.ts when adding endpoints.
 */
import type { OpenAPIObject } from 'openapi3-ts/oas30';

export const openapi: OpenAPIObject = {
  openapi: '3.0.3',
  info: {
    title: 'DeskBoard API',
    version: '1.0.0',
    description:
      'Internal meeting-room booking REST API. Employee accounts self-register; the seeded admin is admin@deskboard.local / admin123. Business hours: Mon–Fri 08:00–19:00 local, bookings ≤ 4h.',
  },
  servers: [{ url: '/api' }],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      ErrorBody: {
        type: 'object',
        required: ['code', 'message'],
        properties: {
          code: { type: 'string' },
          message: { type: 'string' },
          details: {},
        },
      },
      ErrorResponse: {
        type: 'object',
        required: ['error'],
        properties: { error: { $ref: '#/components/schemas/ErrorBody' } },
      },
      PublicUser: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          email: { type: 'string' },
          role: { type: 'string', enum: ['admin', 'employee'] },
        },
      },
      AuthResponse: {
        type: 'object',
        properties: {
          token: { type: 'string' },
          user: { $ref: '#/components/schemas/PublicUser' },
        },
      },
      RegisterRequest: {
        type: 'object',
        required: ['name', 'email', 'password'],
        properties: {
          name: { type: 'string' },
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 8 },
        },
      },
      LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: { email: { type: 'string' }, password: { type: 'string' } },
      },
      ChangePasswordRequest: {
        type: 'object',
        required: ['currentPassword', 'newPassword'],
        properties: { currentPassword: { type: 'string' }, newPassword: { type: 'string', minLength: 8 } },
      },
      Feature: { type: 'string', enum: ['screen', 'whiteboard', 'videoconf', 'phone'] },
      Room: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          capacity: { type: 'integer', minimum: 1, maximum: 100 },
          floor: { type: 'integer', minimum: 1, maximum: 30 },
          features: { type: 'array', items: { $ref: '#/components/schemas/Feature' } },
          active: { type: 'boolean' },
        },
      },
      RoomCreateRequest: {
        type: 'object',
        required: ['name', 'capacity', 'floor', 'features'],
        properties: {
          name: { type: 'string' },
          capacity: { type: 'integer', minimum: 1, maximum: 100 },
          floor: { type: 'integer', minimum: 1, maximum: 30 },
          features: { type: 'array', items: { $ref: '#/components/schemas/Feature' } },
        },
      },
      RoomUpdateRequest: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          capacity: { type: 'integer', minimum: 1, maximum: 100 },
          floor: { type: 'integer', minimum: 1, maximum: 30 },
          features: { type: 'array', items: { $ref: '#/components/schemas/Feature' } },
        },
      },
      Recurrence: {
        oneOf: [
          { type: 'object', required: ['kind'], properties: { kind: { type: 'string', enum: ['none'] } } },
          {
            type: 'object',
            required: ['kind', 'count'],
            properties: {
              kind: { type: 'string', enum: ['weekly'] },
              count: { type: 'integer', minimum: 1, maximum: 52 },
            },
          },
        ],
      },
      BookingCreateRequest: {
        type: 'object',
        required: ['roomId', 'title', 'start', 'durationMinutes', 'attendees', 'recurrence'],
        properties: {
          roomId: { type: 'string' },
          title: { type: 'string', maxLength: 100 },
          start: { type: 'string', description: 'ISO-8601 datetime, minute precision' },
          durationMinutes: { type: 'integer', minimum: 30, maximum: 240, multipleOf: 30 },
          attendees: { type: 'integer', minimum: 1 },
          recurrence: { $ref: '#/components/schemas/Recurrence' },
        },
      },
      Booking: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          roomId: { type: 'string' },
          roomName: { type: 'string' },
          title: { type: 'string' },
          organizerId: { type: 'string' },
          start: { type: 'string' },
          end: { type: 'string' },
          recurrence: { $ref: '#/components/schemas/Recurrence' },
          status: { type: 'string', enum: ['confirmed', 'cancelled', 'completed'] },
          attendees: { type: 'integer' },
          createdAt: { type: 'string' },
        },
      },
      AvailabilitySlot: {
        type: 'object',
        properties: {
          start: { type: 'string' },
          end: { type: 'string' },
          status: { type: 'string', enum: ['free', 'busy'] },
          bookings: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                title: { type: 'string' },
                status: { type: 'string', enum: ['confirmed', 'cancelled', 'completed'] },
                organizerId: { type: 'string' },
              },
            },
          },
        },
      },
      AvailabilityResponse: {
        type: 'object',
        properties: {
          date: { type: 'string' },
          roomId: { type: 'string' },
          roomName: { type: 'string' },
          slots: { type: 'array', items: { $ref: '#/components/schemas/AvailabilitySlot' } },
        },
      },
      UsageRoomRow: {
        type: 'object',
        properties: {
          roomId: { type: 'string' },
          roomName: { type: 'string' },
          bookedHours: { type: 'number' },
          bookings: { type: 'integer' },
          topOrganizer: {
            type: 'object',
            nullable: true,
            properties: { email: { type: 'string' }, bookings: { type: 'integer' } },
          },
        },
      },
      UsageResponse: {
        type: 'object',
        properties: {
          from: { type: 'string' },
          to: { type: 'string' },
          rooms: { type: 'array', items: { $ref: '#/components/schemas/UsageRoomRow' } },
        },
      },
    },
  },
  paths: {
    '/health': {
      get: {
        tags: ['system'],
        summary: 'Liveness probe',
        responses: { 200: { description: 'Service is healthy' } },
      },
    },
    '/auth/register': {
      post: {
        tags: ['auth'],
        summary: 'Register an employee account',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/RegisterRequest' } } },
        },
        responses: {
          201: { description: 'Created', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } } } },
          400: { description: 'Validation error', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          409: { description: 'Email already taken' },
        },
      },
    },
    '/auth/login': {
      post: {
        tags: ['auth'],
        summary: 'Log in with email + password',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginRequest' } } },
        },
        responses: {
          200: { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } } } },
          401: { description: 'Invalid credentials' },
        },
      },
    },
    '/auth/me': {
      get: {
        tags: ['auth'],
        summary: 'Current user',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/PublicUser' } } } },
          401: { description: 'Unauthenticated' },
        },
      },
    },
    '/users/me/password': {
      put: {
        tags: ['users'],
        summary: 'Change own password',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ChangePasswordRequest' } } },
        },
        responses: {
          200: { description: 'Changed' },
          400: { description: 'Validation error' },
          401: { description: 'Unauthenticated or wrong current password' },
        },
      },
    },
    '/rooms': {
      get: {
        tags: ['rooms'],
        summary: 'List rooms',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'OK' } },
      },
      post: {
        tags: ['rooms'],
        summary: 'Create room (admin)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/RoomCreateRequest' } } },
        },
        responses: {
          201: { description: 'Created', content: { 'application/json': { schema: { $ref: '#/components/schemas/Room' } } } },
          400: { description: 'Validation error' },
          403: { description: 'Forbidden (not admin)' },
          409: { description: 'Room name taken' },
        },
      },
    },
    '/rooms/{id}': {
      put: {
        tags: ['rooms'],
        summary: 'Update room (admin)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/RoomUpdateRequest' } } },
        },
        responses: {
          200: { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/Room' } } } },
          400: { description: 'Validation error' },
          403: { description: 'Forbidden' },
          404: { description: 'Room not found' },
          409: { description: 'Room name taken' },
        },
      },
      delete: {
        tags: ['rooms'],
        summary: 'Deactivate room (admin, soft delete)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Deactivated room', content: { 'application/json': { schema: { $ref: '#/components/schemas/Room' } } } },
          403: { description: 'Forbidden' },
          404: { description: 'Room not found' },
        },
      },
    },
    '/rooms/{id}/availability': {
      get: {
        tags: ['rooms'],
        summary: 'Free/busy grid for a room and day',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'date', in: 'query', required: true, schema: { type: 'string', description: 'YYYY-MM-DD' } },
        ],
        responses: {
          200: { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/AvailabilityResponse' } } } },
          400: { description: 'Validation error' },
          404: { description: 'Room not found' },
        },
      },
    },
    '/bookings': {
      post: {
        tags: ['bookings'],
        summary: 'Create booking or weekly series',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/BookingCreateRequest' } } },
        },
        responses: {
          201: {
            description: 'Created occurrence(s)',
            content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Booking' } } } },
          },
          400: { description: 'Validation error' },
          404: { description: 'Room not found' },
          409: { description: 'Room conflict' },
          422: { description: 'Rule violation (hours, capacity, past, deactivated)' },
        },
      },
      get: {
        tags: ['bookings'],
        summary: 'List bookings (admin: all, filtered; employee: own)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'date', in: 'query', schema: { type: 'string', description: 'YYYY-MM-DD' } },
          { name: 'roomId', in: 'query', schema: { type: 'string' } },
        ],
        responses: { 200: { description: 'OK' } },
      },
    },
    '/bookings/mine': {
      get: {
        tags: ['bookings'],
        summary: 'List own bookings',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'OK' } },
      },
    },
    '/bookings/{id}': {
      delete: {
        tags: ['bookings'],
        summary: 'Cancel a booking',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Cancelled booking' },
          403: { description: 'Forbidden (not organizer, not admin)' },
          404: { description: 'Booking not found' },
          409: { description: 'Already cancelled' },
          422: { description: 'Cancellation window closed' },
        },
      },
    },
    '/admin/usage': {
      get: {
        tags: ['admin'],
        summary: 'Per-room usage report (admin)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'from', in: 'query', schema: { type: 'string', description: 'YYYY-MM-DD (default: 30 days ago)' } },
          { name: 'to', in: 'query', schema: { type: 'string', description: 'YYYY-MM-DD (default: today)' } },
        ],
        responses: {
          200: { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/UsageResponse' } } } },
          400: { description: 'Validation error' },
          403: { description: 'Forbidden' },
        },
      },
    },
  },
};
