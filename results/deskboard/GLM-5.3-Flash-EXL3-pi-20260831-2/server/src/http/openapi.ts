/**
 * OpenAPI 3.0 description of the full API surface. Served as Swagger UI at
 * /api-docs. Kept hand-written so the contract is explicit and reviewable.
 */

/** Reusable 4xx responses shared by every endpoint. */
const errorResponses = {
  ValidationError: {
    description: 'Request validation failed',
    content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
  },
  Unauthenticated: {
    description: 'Missing or invalid credentials',
    content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
  },
  Forbidden: {
    description: 'Authenticated but not allowed (role/ownership)',
    content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
  },
  NotFound: {
    description: 'Unknown resource',
    content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
  },
};

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'DeskBoard API',
    version: '2.0.0',
    description: 'Meeting-room booking API. All endpoints are prefixed with /api.',
  },
  servers: [{ url: '/' }],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    responses: errorResponses,
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'ROOM_CONFLICT' },
              message: { type: 'string' },
              details: {
                type: 'object',
                additionalProperties: { type: 'array', items: { type: 'string' } },
              },
            },
            required: ['code', 'message'],
          },
        },
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          email: { type: 'string', format: 'email' },
          role: { type: 'string', enum: ['admin', 'employee'] },
        },
      },
      AuthResponse: {
        type: 'object',
        properties: { token: { type: 'string' }, user: { $ref: '#/components/schemas/User' } },
      },
      Room: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          capacity: { type: 'integer', minimum: 1, maximum: 100 },
          floor: { type: 'integer', minimum: 1, maximum: 30 },
          features: {
            type: 'array',
            items: { type: 'string', enum: ['screen', 'whiteboard', 'videoconf', 'phone'] },
          },
          active: { type: 'boolean' },
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
          start: { type: 'string', example: '2026-09-01T09:00:00.000Z' },
          end: { type: 'string', example: '2026-09-01T10:00:00.000Z' },
          status: { type: 'string', enum: ['confirmed', 'cancelled', 'completed'] },
          attendees: { type: 'integer', minimum: 1 },
          createdAt: { type: 'string' },
        },
      },
      Availability: {
        type: 'object',
        properties: {
          roomId: { type: 'string' },
          date: { type: 'string', example: '2026-09-01' },
          slots: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                start: { type: 'string', example: '09:00' },
                end: { type: 'string', example: '10:00' },
                available: { type: 'boolean' },
                bookingId: { type: 'string' },
                title: { type: 'string' },
              },
            },
          },
        },
      },
    },
  },
  paths: {
    '/health': {
      get: {
        summary: 'Liveness probe',
        tags: ['Health'],
        responses: { '200': { description: 'Service is healthy' } },
      },
    },
    '/api/health': {
      get: {
        summary: 'Liveness probe (API-prefixed alias)',
        tags: ['Health'],
        responses: { '200': { description: 'Service is healthy' } },
      },
    },
    '/api/auth/register': {
      post: {
        summary: 'Register an employee account',
        tags: ['Auth'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'email', 'password'],
                properties: {
                  name: { type: 'string', maxLength: 80 },
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', minLength: 8 },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Account created; returns a JWT (12h expiry)',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } },
            },
          },
          '400': { $ref: '#/components/responses/ValidationError' },
          '409': {
            description: 'Email already in use',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
        },
      },
    },
    '/api/auth/login': {
      post: {
        summary: 'Log in with email + password',
        tags: ['Auth'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: { email: { type: 'string' }, password: { type: 'string' } },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'JWT issued',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } },
            },
          },
          '401': {
            description: 'Invalid credentials',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
        },
      },
    },
    '/api/auth/me': {
      get: {
        summary: 'Current authenticated user',
        tags: ['Auth'],
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'The user',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } },
          },
          '401': { $ref: '#/components/responses/Unauthenticated' },
        },
      },
    },
    '/api/rooms': {
      get: {
        summary: 'List all rooms (including deactivated)',
        tags: ['Rooms'],
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Room list',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/Room' } },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthenticated' },
        },
      },
      post: {
        summary: 'Create a room (admin only)',
        tags: ['Rooms'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Room' } } },
        },
        responses: {
          '201': {
            description: 'Room created',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Room' } } },
          },
          '400': { $ref: '#/components/responses/ValidationError' },
          '401': { $ref: '#/components/responses/Unauthenticated' },
          '403': { $ref: '#/components/responses/Forbidden' },
          '409': {
            description: 'Duplicate room name (case-insensitive)',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
        },
      },
    },
    '/api/rooms/{id}': {
      put: {
        summary: 'Update a room (admin only)',
        tags: ['Rooms'],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Room' } } },
        },
        responses: {
          '200': {
            description: 'Room updated',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Room' } } },
          },
          '401': { $ref: '#/components/responses/Unauthenticated' },
          '403': { $ref: '#/components/responses/Forbidden' },
          '404': { $ref: '#/components/responses/NotFound' },
          '409': {
            description: 'Duplicate room name',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
        },
      },
      delete: {
        summary: 'Soft-deactivate a room (admin only)',
        description:
          'The room stays listed but rejects new bookings. Existing bookings and cancellations are unaffected.',
        tags: ['Rooms'],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': {
            description: 'Deactivated room',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Room' } } },
          },
          '401': { $ref: '#/components/responses/Unauthenticated' },
          '403': { $ref: '#/components/responses/Forbidden' },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/api/rooms/{id}/availability': {
      get: {
        summary: 'Free/busy grid for one room on a date (hourly 08:00–19:00 local)',
        tags: ['Rooms'],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          {
            name: 'date',
            in: 'query',
            required: true,
            schema: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
          },
        ],
        responses: {
          '200': {
            description: 'Availability grid',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/Availability' } },
            },
          },
          '400': { $ref: '#/components/responses/ValidationError' },
          '401': { $ref: '#/components/responses/Unauthenticated' },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/api/bookings': {
      post: {
        summary: 'Create a booking',
        description:
          'Enforces business hours (Mon–Fri 08:00–19:00 local, ≤ 4h), room conflicts (409), capacity (422) and room activity (409).',
        tags: ['Bookings'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['roomId', 'title', 'start', 'end', 'attendees'],
                properties: {
                  roomId: { type: 'string' },
                  title: { type: 'string', minLength: 1, maxLength: 100 },
                  start: { type: 'string', example: '2026-09-01T09:00 (local, minutes precision)' },
                  end: { type: 'string', example: '2026-09-01T10:00 (local, minutes precision)' },
                  attendees: { type: 'integer', minimum: 1 },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Booking created',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Booking' } } },
          },
          '400': { $ref: '#/components/responses/ValidationError' },
          '401': { $ref: '#/components/responses/Unauthenticated' },
          '404': { $ref: '#/components/responses/NotFound' },
          '409': {
            description: 'ROOM_CONFLICT or ROOM_INACTIVE',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
          '422': {
            description: 'Business-rule violation',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
        },
      },
    },
    '/api/bookings/mine': {
      get: {
        summary: 'List the authenticated user’s bookings (computed status)',
        tags: ['Bookings'],
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Own bookings, oldest first',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/Booking' } },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthenticated' },
        },
      },
    },
    '/api/bookings/{id}': {
      delete: {
        summary: 'Cancel a booking',
        description:
          'Organizer may cancel up to 1h before start; admin anytime; others never (403).',
        tags: ['Bookings'],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': {
            description: 'Cancelled booking',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Booking' } } },
          },
          '401': { $ref: '#/components/responses/Unauthenticated' },
          '403': { $ref: '#/components/responses/Forbidden' },
          '404': { $ref: '#/components/responses/NotFound' },
          '422': {
            description: 'Cancellation window passed or already cancelled',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
        },
      },
    },
  },
};
