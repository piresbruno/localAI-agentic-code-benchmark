/**
 * Hand-written OpenAPI 3 document describing every endpoint (spec §2.5).
 * Served as Swagger UI at GET /api-docs.
 */
export const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'DeskBoard API',
    description:
      'Meeting room booking API. All errors use `{ error: { code, message, details? } }`.',
    version: '1.0.0',
  },
  servers: [{ url: '/api' }],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    parameters: {
      RoomId: {
        name: 'id',
        in: 'path',
        required: true,
        schema: { type: 'string' },
        description: 'Room id',
      },
      BookingId: {
        name: 'id',
        in: 'path',
        required: true,
        schema: { type: 'string' },
        description: 'Booking id',
      },
    },
    responses: {
      ValidationError: {
        description: 'Validation failed (400)',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      },
      Unauthorized: {
        description: 'Missing or invalid token (401)',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      },
      Forbidden: {
        description: 'Requires admin role (403)',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      },
      NotFound: {
        description: 'Unknown resource (404)',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      },
      Conflict: {
        description: 'Conflict (409)',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      },
      RuleViolation: {
        description: 'Rule violation (422)',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      },
    },
    schemas: {
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
        properties: {
          token: { type: 'string', description: 'JWT, expires in 12h' },
          user: { $ref: '#/components/schemas/User' },
        },
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
      AvailabilityResponse: {
        type: 'object',
        properties: {
          roomId: { type: 'string' },
          date: { type: 'string', format: 'date' },
          slots: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                start: { type: 'string', example: '08:00' },
                end: { type: 'string', example: '09:00' },
                available: { type: 'boolean' },
              },
            },
          },
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
          start: {
            type: 'string',
            example: '2026-09-01T09:00',
            description: 'Local ISO, minutes precision',
          },
          end: { type: 'string', example: '2026-09-01T10:00' },
          status: { type: 'string', enum: ['confirmed', 'cancelled', 'completed'] },
          attendees: { type: 'integer', minimum: 1 },
          createdAt: { type: 'string' },
        },
      },
      Error: {
        type: 'object',
        properties: {
          error: {
            type: 'object',
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
              details: {},
            },
          },
        },
      },
    },
  },
  paths: {
    '/health': {
      get: { summary: 'Liveness probe', responses: { 200: { description: 'OK' } } },
    },
    '/auth/register': {
      post: {
        summary: 'Register as employee',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'email', 'password'],
                properties: {
                  name: { type: 'string', maxLength: 100 },
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', minLength: 8 },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Registered; returns JWT + user',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } },
            },
          },
          400: { $ref: '#/components/responses/ValidationError' },
          409: { $ref: '#/components/responses/Conflict' },
        },
      },
    },
    '/auth/login': {
      post: {
        summary: 'Log in',
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
          200: {
            description: 'JWT + user',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/auth/me': {
      get: {
        summary: 'Current user profile',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'The authenticated user',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/rooms': {
      get: {
        summary: 'List all rooms',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'Rooms',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/Room' } },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
      post: {
        summary: 'Create a room (admin only)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Room' } } },
        },
        responses: {
          201: {
            description: 'Created room',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Room' } } },
          },
          400: { $ref: '#/components/responses/ValidationError' },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
          409: { $ref: '#/components/responses/Conflict' },
        },
      },
    },
    '/rooms/{id}': {
      put: {
        summary: 'Update a room (admin only)',
        security: [{ bearerAuth: [] }],
        parameters: [{ $ref: '#/components/parameters/RoomId' }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Room' } } },
        },
        responses: {
          200: {
            description: 'Updated room',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Room' } } },
          },
          400: { $ref: '#/components/responses/ValidationError' },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
      delete: {
        summary: 'Deactivate a room (soft delete, admin only)',
        security: [{ bearerAuth: [] }],
        parameters: [{ $ref: '#/components/parameters/RoomId' }],
        responses: {
          200: {
            description: 'Deactivated room',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Room' } } },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/rooms/{id}/availability': {
      get: {
        summary: 'Free/busy grid for a date (hourly slots 08:00–19:00)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { $ref: '#/components/parameters/RoomId' },
          { name: 'date', in: 'query', required: true, schema: { type: 'string', format: 'date' } },
        ],
        responses: {
          200: {
            description: 'Availability grid',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/AvailabilityResponse' } },
            },
          },
          400: { $ref: '#/components/responses/ValidationError' },
          401: { $ref: '#/components/responses/Unauthorized' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/bookings': {
      post: {
        summary: 'Create a booking',
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
                  title: { type: 'string', maxLength: 100 },
                  start: { type: 'string', example: '2026-09-01T09:00' },
                  end: { type: 'string', example: '2026-09-01T10:00' },
                  attendees: { type: 'integer', minimum: 1 },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Created booking',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Booking' } } },
          },
          400: { $ref: '#/components/responses/ValidationError' },
          401: { $ref: '#/components/responses/Unauthorized' },
          404: { $ref: '#/components/responses/NotFound' },
          409: {
            description: 'ROOM_CONFLICT or ROOM_INACTIVE',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
          422: {
            description: 'RULE_VIOLATION or CAPACITY_EXCEEDED',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
        },
      },
    },
    '/bookings/mine': {
      get: {
        summary: 'List own bookings',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'Own bookings',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/Booking' } },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/bookings/{id}': {
      delete: {
        summary: 'Cancel a booking (organizer up to 1h before start; admin anytime)',
        security: [{ bearerAuth: [] }],
        parameters: [{ $ref: '#/components/parameters/BookingId' }],
        responses: {
          200: {
            description: 'Cancelled booking',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Booking' } } },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: {
            description: 'Forbidden or cancellation window closed',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },
  },
};
