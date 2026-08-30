/**
 * OpenAPI 3.0 description of the API (spec §5) plus the Swagger UI page
 * served at /api-docs. Kept declarative; excluded from the coverage gate.
 */
import type { Express } from 'express';

const errorResponse = (description: string) => ({
  description,
  content: {
    'application/json': {
      schema: { $ref: '#/components/schemas/ErrorContract' }
    }
  }
});

const jsonBody = (schema: string) => ({
  required: true,
  content: { 'application/json': { schema: { $ref: `#/components/schemas/${schema}` } } }
});

const okJson = (schema: string) => ({
  description: 'Success',
  content: { 'application/json': { schema: { $ref: `#/components/schemas/${schema}` } } }
});

const bearer = [{ bearerAuth: [] }];

export const openapiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'DeskBoard API',
    version: '1.0.0',
    description: 'Meeting room booking API. All routes are prefixed with /api.'
  },
  servers: [{ url: '/' }],
  components: {
    securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
    schemas: {
      ErrorContract: {
        type: 'object',
        properties: {
          error: {
            type: 'object',
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
              details: {}
            }
          }
        }
      },
      AuthResponse: {
        type: 'object',
        properties: {
          token: { type: 'string' },
          user: { $ref: '#/components/schemas/PublicUser' }
        }
      },
      PublicUser: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          email: { type: 'string' },
          role: { type: 'string', enum: ['admin', 'employee'] }
        }
      },
      Room: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          capacity: { type: 'integer', minimum: 1, maximum: 100 },
          floor: { type: 'integer', minimum: 1, maximum: 30 },
          features: { type: 'array', items: { type: 'string' } },
          active: { type: 'boolean' }
        }
      },
      Booking: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          roomId: { type: 'string' },
          title: { type: 'string' },
          start: { type: 'string', example: '2026-09-01T09:00' },
          end: { type: 'string', example: '2026-09-01T10:00' },
          status: { type: 'string', enum: ['confirmed', 'cancelled', 'completed'] },
          attendees: { type: 'integer' },
          recurrence: {
            oneOf: [
              { type: 'object', properties: { kind: { type: 'string', enum: ['none'] } } },
              {
                type: 'object',
                properties: { kind: { type: 'string', enum: ['weekly'] }, count: { type: 'integer' } }
              }
            ]
          },
          organizer: { $ref: '#/components/schemas/PublicUser' }
        }
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
                bookingId: { type: 'string' },
                bookingTitle: { type: 'string' }
              }
            }
          }
        }
      },
      UsageReport: {
        type: 'object',
        properties: {
          from: { type: 'string', format: 'date' },
          to: { type: 'string', format: 'date' },
          rooms: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                room: { $ref: '#/components/schemas/Room' },
                totalHours: { type: 'number' },
                bookingCount: { type: 'integer' },
                topOrganizer: { type: 'object', nullable: true }
              }
            }
          }
        }
      },
      RegisterInput: {
        type: 'object',
        required: ['name', 'email', 'password'],
        properties: {
          name: { type: 'string', maxLength: 100 },
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 8 }
        }
      },
      LoginInput: {
        type: 'object',
        required: ['email', 'password'],
        properties: { email: { type: 'string', format: 'email' }, password: { type: 'string' } }
      },
      PasswordChange: {
        type: 'object',
        required: ['currentPassword', 'newPassword'],
        properties: { currentPassword: { type: 'string' }, newPassword: { type: 'string', minLength: 8 } }
      },
      RoomInput: {
        type: 'object',
        required: ['name', 'capacity', 'floor'],
        properties: {
          name: { type: 'string' },
          capacity: { type: 'integer', minimum: 1, maximum: 100 },
          floor: { type: 'integer', minimum: 1, maximum: 30 },
          features: { type: 'array', items: { type: 'string', enum: ['screen', 'whiteboard', 'videoconf', 'phone'] } }
        }
      },
      BookingInput: {
        type: 'object',
        required: ['roomId', 'title', 'start', 'durationMinutes', 'attendees'],
        properties: {
          roomId: { type: 'string' },
          title: { type: 'string', maxLength: 100 },
          start: { type: 'string', example: '2026-09-01T09:00' },
          durationMinutes: { type: 'integer', enum: [30, 60, 90, 120] },
          attendees: { type: 'integer', minimum: 1 },
          recurrence: {
            oneOf: [
              { type: 'object', properties: { kind: { type: 'string', enum: ['none'] } } },
              {
                type: 'object',
                required: ['count'],
                properties: { kind: { type: 'string', enum: ['weekly'] }, count: { type: 'integer', minimum: 2, maximum: 12 } }
              }
            ]
          }
        }
      }
    }
  },
  paths: {
    '/api/health': {
      get: { summary: 'Health check', responses: { 200: { description: 'OK' } } }
    },
    '/api/auth/register': {
      post: {
        summary: 'Register as employee',
        requestBody: jsonBody('RegisterInput'),
        responses: { 201: okJson('AuthResponse'), 400: errorResponse('Validation failed'), 409: errorResponse('Email in use') }
      }
    },
    '/api/auth/login': {
      post: {
        summary: 'Log in',
        requestBody: jsonBody('LoginInput'),
        responses: { 200: okJson('AuthResponse'), 401: errorResponse('Invalid credentials') }
      }
    },
    '/api/auth/me': {
      get: {
        summary: 'Current user',
        security: bearer,
        responses: { 200: okJson('PublicUser'), 401: errorResponse('Unauthenticated') }
      }
    },
    '/api/rooms': {
      get: {
        summary: 'List rooms',
        security: bearer,
        responses: {
          200: {
            description: 'Rooms',
            content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Room' } } } }
          },
          401: errorResponse('Unauthenticated')
        }
      },
      post: {
        summary: 'Create room (admin)',
        security: bearer,
        requestBody: jsonBody('RoomInput'),
        responses: {
          201: okJson('Room'),
          401: errorResponse('Unauthenticated'),
          403: errorResponse('Not admin'),
          409: errorResponse('Duplicate room name')
        }
      }
    },
    '/api/rooms/{id}': {
      put: {
        summary: 'Update room (admin)',
        security: bearer,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: jsonBody('RoomInput'),
        responses: {
          200: okJson('Room'),
          403: errorResponse('Not admin'),
          404: errorResponse('Unknown room'),
          409: errorResponse('Duplicate room name')
        }
      },
      delete: {
        summary: 'Deactivate room (admin, soft delete)',
        security: bearer,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: okJson('Room'), 403: errorResponse('Not admin'), 404: errorResponse('Unknown room') }
      }
    },
    '/api/rooms/{id}/availability': {
      get: {
        summary: 'Free/busy grid for a date',
        security: bearer,
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'date', in: 'query', required: true, schema: { type: 'string', format: 'date' } }
        ],
        responses: { 200: okJson('AvailabilityResponse'), 404: errorResponse('Unknown room') }
      }
    },
    '/api/bookings': {
      get: {
        summary: 'List bookings (admin: all, employee: own)',
        security: bearer,
        parameters: [
          { name: 'date', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'roomId', in: 'query', schema: { type: 'string' } }
        ],
        responses: {
          200: {
            description: 'Bookings',
            content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Booking' } } } }
          }
        }
      },
      post: {
        summary: 'Create booking (weekly recurrence expands to occurrences)',
        security: bearer,
        requestBody: jsonBody('BookingInput'),
        responses: {
          201: {
            description: 'Created occurrences',
            content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Booking' } } } }
          },
          400: errorResponse('Validation failed'),
          404: errorResponse('Unknown room'),
          409: errorResponse('Room conflict'),
          422: errorResponse('Rule violation (capacity, business hours, inactive room)')
        }
      }
    },
    '/api/bookings/mine': {
      get: {
        summary: 'List own bookings',
        security: bearer,
        responses: {
          200: {
            description: 'Own bookings',
            content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Booking' } } } }
          }
        }
      }
    },
    '/api/bookings/{id}': {
      delete: {
        summary: 'Cancel a booking (window + role rules apply)',
        security: bearer,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: okJson('Booking'),
          403: errorResponse('Not organizer/admin'),
          404: errorResponse('Unknown booking'),
          409: errorResponse('Already cancelled'),
          422: errorResponse('Inside the 1-hour cancellation window')
        }
      }
    },
    '/api/users/me/password': {
      put: {
        summary: 'Change own password',
        security: bearer,
        requestBody: jsonBody('PasswordChange'),
        responses: { 200: { description: 'Changed' }, 401: errorResponse('Unauthenticated'), 403: errorResponse('Wrong current password') }
      }
    },
    '/api/admin/usage': {
      get: {
        summary: 'Per-room usage report (admin)',
        security: bearer,
        parameters: [
          { name: 'from', in: 'query', required: true, schema: { type: 'string', format: 'date' } },
          { name: 'to', in: 'query', required: true, schema: { type: 'string', format: 'date' } }
        ],
        responses: { 200: okJson('UsageReport'), 403: errorResponse('Not admin') }
      }
    }
  }
} as const;

const SWAGGER_HTML = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>DeskBoard API docs</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  </head>
  <body>
    <div id="swagger"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
      SwaggerUIBundle({ url: '/openapi.json', dom_id: '#swagger' });
    </script>
  </body>
</html>`;

export const registerDocsRoutes = (app: Express): void => {
  app.get('/openapi.json', (_req, res) => {
    res.json(openapiDocument);
  });
  app.get('/api-docs', (_req, res) => {
    res.type('html').send(SWAGGER_HTML);
  });
};
