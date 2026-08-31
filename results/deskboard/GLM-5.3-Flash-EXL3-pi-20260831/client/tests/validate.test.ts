import { describe, expect, it } from 'vitest';
import { bookingCreateSchema, registerSchema } from '@deskboard/shared';
import { apiDetailErrors, schemaFieldErrors } from '../src/lib/validate';
import { WED } from './fixtures';

describe('schemaFieldErrors', () => {
  it('returns nothing for valid input', () => {
    const errors = schemaFieldErrors(bookingCreateSchema, {
      roomId: 'r1',
      title: 'Sync',
      start: `${WED}T11:00`,
      end: `${WED}T12:00`,
      attendees: 2,
    });
    expect(errors).toEqual({});
  });

  it('flattens invalid fields into { field: message }', () => {
    const errors = schemaFieldErrors(bookingCreateSchema, {
      roomId: 'r1',
      title: '',
      start: 'not-a-date',
      end: `${WED}T12:00`,
      attendees: 0,
    });
    expect(errors['title']).toBeTruthy();
    expect(errors['start']).toBeTruthy();
    expect(errors['attendees']).toBeTruthy();
  });

  it('validates registration input against the shared schema', () => {
    const errors = schemaFieldErrors(registerSchema, { name: '', email: 'nope', password: 'x' });
    expect(Object.keys(errors)).toEqual(['name', 'email', 'password']);
  });
});

describe('apiDetailErrors', () => {
  it('maps API error details to field errors, first wins', () => {
    const errors = apiDetailErrors([
      { field: 'title', message: 'Title is required' },
      { field: 'title', message: 'duplicate' },
    ]);
    expect(errors).toEqual({ title: 'Title is required' });
  });

  it('tolerates undefined details', () => {
    expect(apiDetailErrors(undefined)).toEqual({});
  });
});
