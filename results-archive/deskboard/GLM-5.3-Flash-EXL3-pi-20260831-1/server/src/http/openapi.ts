/** Hand-written OpenAPI 3 description of the §5 API surface, served at /api-docs. */

const errorResponse = (description: string) => ({
  description,
  content: {
    'application/json': {
      schema: { $ref: '#/components/schemas/Error' },
    },
  },
});

const jsonBody = (ref: string) => ({
  required: true,
  content: { 'application/json': { schema: { $ref: `#/components/schemas/${ref}` } } },
});

const auth = [{ bearerAuth: [] as string[] }];

const p = (summary: string, responses: Record<string, unknown>, extra: object = {}) => ({
  summary,
  responses,
  ...extra,
});

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'DeskBoard API',
    version: '1.0.0',
    description: 'Meeting-room booking API. All routes are prefixed with /api.',
  },
  components: {
    securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: {
            type: 'object',
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
              details: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: { field: { type: 'string' }, message: { type: 'string' } },
                },
              },
            },
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
          features: { type: 'array', items: { type: 'string', enum: ['screen', 'whiteboard', 'videoconf', 'phone'] } },
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
          organizerName: { type: 'string' },
          start: { type: 'string', example: '2026-09-02T11:00' },
          end: { type: 'string', example: '2026-09-02T12:00' },
          status: { type: 'string', enum: ['confirmed', 'cancelled', 'completed'] },
          attendees: { type: 'integer' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Availability: {
        type: 'object',
        properties: {
          roomId: { type: 'string' },
          date: { type: 'string', example: '2026-09-02' },
          slots: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                start: { type: 'string', example: '08:00' },
                end: { type: 'string', example: '09:00' },
                booking: { type: 'object', nullable: true, properties: { id: { type: 'string' }, title: { type: 'string' } } },
              },
            },
          },
        },
      },
      RegisterInput: {
        type: 'object',
        required: ['name', 'email', 'password'],
        properties: {
          name: { type: 'string', maxLength: 80 },
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 8, maxLength: 72 },
        },
      },
      LoginInput: {
        type: 'object',
        required: ['email', 'password'],
        properties: { email: { type: 'string', format: 'email' }, password: { type: 'string' } },
      },
      RoomInput: {
        type: 'object',
        required: ['name', 'capacity', 'floor'],
        properties: {
          name: { type: 'string', maxLength: 60 },
          capacity: { type: 'integer', minimum: 1, maximum: 100 },
          floor: { type: 'integer', minimum: 1, maximum: 30 },
          features: { type: 'array', items: { type: 'string', enum: ['screen', 'whiteboard', 'videoconf', 'phone'] } },
          active: { type: 'boolean' },
        },
      },
      BookingInput: {
        type: 'object',
        required: ['roomId', 'title', 'start', 'end', 'attendees'],
        properties: {
          roomId: { type: 'string' },
          title: { type: 'string', maxLength: 100 },
          start: { type: 'string', example: '2026-09-02T11:00' },
          end: { type: 'string', example: '2026-09-02T12:00' },
          attendees: { type: 'integer', minimum: 1 },
        },
      },
    },
  },
  paths: {
    '/api/health': {
      get: p('Liveness probe', {
        200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'string' } } } } } },
      }),
    },
    '/api/auth/register': {
      post: p('Register an employee account', {
        201: { description: 'Created', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } } } },
        400: errorResponse('Validation failed'),
        409: errorResponse('Email already registered'),
      }, { requestBody: jsonBody('RegisterInput') }),
    },
    '/api/auth/login': {
      post: p('Log in, returns a 12h JWT', {
        200: { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } } } },
        401: errorResponse('Invalid credentials'),
      }, { requestBody: jsonBody('LoginInput') }),
    },
    '/api/auth/me': {
      get: p('Current user', {
        200: { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } } },
        401: errorResponse('Unauthenticated'),
      }, { security: auth }),
    },
    '/api/rooms': {
      get: p('List all rooms', {
        200: { description: 'OK', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Room' } } } } },
        401: errorResponse('Unauthenticated'),
      }, { security: auth }),
      post: p('Create a room (admin only)', {
        201: { description: 'Created', content: { 'application/json': { schema: { $ref: '#/components/schemas/Room' } } } },
        400: errorResponse('Validation failed'),
        403: errorResponse('Not an admin'),
        409: errorResponse('Duplicate room name'),
      }, { security: auth, requestBody: jsonBody('RoomInput') }),
    },
    '/api/rooms/{id}': {
      put: p('Update a room (admin only)', {
        200: { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/Room' } } } },
        403: errorResponse('Not an admin'),
        404: errorResponse('Unknown room'),
        409: errorResponse('Duplicate room name'),
      }, { security: auth, requestBody: jsonBody('RoomInput') }),
      delete: p('Soft-deactivate a room (admin only)', {
        200: { description: 'Deactivated room', content: { 'application/json': { schema: { $ref: '#/components/schemas/Room' } } } },
        403: errorResponse('Not an admin'),
        404: errorResponse('Unknown room'),
      }, { security: auth }),
    },
    '/api/rooms/{id}/availability': {
      get: p('Free/busy grid for one day (08:00–19:00 hourly)', {
        200: { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/Availability' } } } },
        400: errorResponse('Bad date'),
        404: errorResponse('Unknown room'),
      }, {
        security: auth,
        parameters: [{ name: 'date', in: 'query', required: true, schema: { type: 'string', example: '2026-09-02' } }],
      }),
    },
    '/api/bookings': {
      post: p('Create a booking', {
        201: { description: 'Created', content: { 'application/json': { schema: { $ref: '#/components/schemas/Booking' } } } },
        400: errorResponse('Validation failed'),
        404: errorResponse('Unknown room'),
        409: errorResponse('ROOM_CONFLICT / ROOM_INACTIVE'),
        422: errorResponse('Business-rule violation (hours, capacity, duration)'),
      }, { security: auth, requestBody: jsonBody('BookingInput') }),
    },
    '/api/bookings/mine': {
      get: p('List the caller’s bookings (status computed on read)', {
        200: { description: 'OK', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Booking' } } } } },
        401: errorResponse('Unauthenticated'),
      }, { security: auth }),
    },
    '/api/bookings/{id}': {
      delete: p('Cancel a booking (organizer ≥1h before start, admin anytime)', {
        200: { description: 'Cancelled booking', content: { 'application/json': { schema: { $ref: '#/components/schemas/Booking' } } } },
        403: errorResponse('Not organizer/admin'),
        404: errorResponse('Unknown booking'),
        409: errorResponse('Already cancelled'),
        422: errorResponse('Cancellation window passed'),
      }, { security: auth }),
    },
  },
} as const;
