/** OpenAPI 3.0 description of the API, served as Swagger UI at /api-docs. */
import type { RequestHandler } from 'express';
import swaggerUi from 'swagger-ui-express';

const errorResponse = (description: string) => ({
  description,
  content: {
    'application/json': {
      schema: {
        type: 'object',
        properties: {
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'ROOM_CONFLICT' },
              message: { type: 'string' },
              details: {},
            },
          },
        },
      },
    },
  },
});

const bearerAuth = [{ bearerAuth: [] }];

export const openapiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'DeskBoard API',
    version: '1.0.0',
    description: 'Meeting-room booking API for a single office.',
  },
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
  },
  paths: {
    '/health': {
      get: {
        summary: 'Liveness probe',
        responses: { 200: { description: 'Service is healthy' } },
      },
    },
    '/api/auth/register': {
      post: {
        summary: 'Register a new employee account',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'email', 'password'],
                properties: {
                  name: { type: 'string' },
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', minLength: 8 },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Registered; returns JWT + user' },
          400: errorResponse('Validation failed'),
          409: errorResponse('Email already registered'),
        },
      },
    },
    '/api/auth/login': {
      post: {
        summary: 'Log in and receive a JWT (12h expiry)',
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
          200: { description: 'JWT + user' },
          401: errorResponse('Invalid credentials'),
        },
      },
    },
    '/api/auth/me': {
      get: {
        summary: 'Current user profile',
        security: bearerAuth,
        responses: { 200: { description: 'User' }, 401: errorResponse('Unauthenticated') },
      },
    },
    '/api/rooms': {
      get: {
        summary: 'List rooms',
        security: bearerAuth,
        responses: { 200: { description: 'Rooms' }, 401: errorResponse('Unauthenticated') },
      },
      post: {
        summary: 'Create a room (admin only)',
        security: bearerAuth,
        responses: {
          201: { description: 'Created' },
          401: errorResponse('Unauthenticated'),
          403: errorResponse('Not admin'),
          409: errorResponse('Duplicate room name'),
        },
      },
    },
    '/api/rooms/{id}': {
      put: {
        summary: 'Update a room (admin only)',
        security: bearerAuth,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Updated' },
          403: errorResponse('Not admin'),
          404: errorResponse('Unknown room'),
        },
      },
      delete: {
        summary: 'Deactivate a room (admin only; soft delete)',
        security: bearerAuth,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Deactivated' },
          403: errorResponse('Not admin'),
          404: errorResponse('Unknown room'),
        },
      },
    },
    '/api/rooms/{id}/availability': {
      get: {
        summary: 'Free/busy grid for one room on one date',
        security: bearerAuth,
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'date', in: 'query', required: true, schema: { type: 'string', format: 'date' } },
        ],
        responses: { 200: { description: 'Hourly slots 08:00–19:00' }, 404: errorResponse('Unknown room') },
      },
    },
    '/api/bookings': {
      post: {
        summary: 'Create a booking (conflict/hours/capacity rules apply)',
        security: bearerAuth,
        responses: {
          201: { description: 'Created' },
          409: errorResponse('ROOM_CONFLICT'),
          422: errorResponse('Business-rule violation'),
        },
      },
      get: {
        summary: 'List bookings (admin: all; employee: own)',
        security: bearerAuth,
        parameters: [
          { name: 'date', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'roomId', in: 'query', schema: { type: 'string' } },
        ],
        responses: { 200: { description: 'Bookings' } },
      },
    },
    '/api/bookings/mine': {
      get: {
        summary: 'Own bookings',
        security: bearerAuth,
        responses: { 200: { description: 'Bookings' } },
      },
    },
    '/api/bookings/{id}': {
      delete: {
        summary: 'Cancel a booking (organizer ≥1h before start; admin anytime)',
        security: bearerAuth,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Cancelled' },
          403: errorResponse('Neither organizer nor admin'),
          422: errorResponse('Inside the cancellation window'),
        },
      },
    },
    '/api/users/me/password': {
      put: {
        summary: 'Change own password',
        security: bearerAuth,
        responses: { 204: { description: 'Changed' }, 400: errorResponse('Validation failed') },
      },
    },
    '/api/admin/usage': {
      get: {
        summary: 'Per-room usage report (admin only)',
        security: bearerAuth,
        parameters: [
          { name: 'from', in: 'query', required: true, schema: { type: 'string', format: 'date' } },
          { name: 'to', in: 'query', required: true, schema: { type: 'string', format: 'date' } },
        ],
        responses: {
          200: { description: 'Usage entries' },
          403: errorResponse('Not admin'),
        },
      },
    },
  },
} as const;

export function swaggerUiMiddleware(): RequestHandler[] {
  return [...swaggerUi.serve, swaggerUi.setup(openapiSpec as object) as unknown as RequestHandler];
}
