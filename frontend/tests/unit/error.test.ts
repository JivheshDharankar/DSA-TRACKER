import { describe, it, expect } from 'vitest';
import { getErrorMessage } from '../../src/utils/error.utils';

describe('getErrorMessage utility', () => {
  it('extracts message from standard Error instances', () => {
    const error = new Error('Database connection failed');
    expect(getErrorMessage(error)).toBe('Database connection failed');
  });

  it('extracts message from Axios-rejected error payloads ({ message, code })', () => {
    const payload = {
      message: 'Problem with S.No #1 already exists in this section',
      code: 'DUPLICATE_S_NO',
    };
    expect(getErrorMessage(payload)).toBe('Problem with S.No #1 already exists in this section');
  });

  it('handles string throwables directly', () => {
    expect(getErrorMessage('Raw string error message')).toBe('Raw string error message');
  });

  it('returns default fallback when err is null', () => {
    expect(getErrorMessage(null)).toBe('An unexpected error occurred.');
  });

  it('returns default fallback when err is undefined', () => {
    expect(getErrorMessage(undefined)).toBe('An unexpected error occurred.');
  });

  it('returns custom fallback when provided for null or undefined', () => {
    expect(getErrorMessage(null, 'Custom error fallback')).toBe('Custom error fallback');
    expect(getErrorMessage(undefined, 'Custom error fallback')).toBe('Custom error fallback');
  });

  it('returns fallback for unknown object structures lacking message property', () => {
    const unknownObj = { status: 500, details: [1, 2, 3] };
    expect(getErrorMessage(unknownObj, 'Fallback for unknown')).toBe('Fallback for unknown');
  });

  it('returns fallback for error objects with empty or whitespace-only messages', () => {
    expect(getErrorMessage({ message: '' })).toBe('An unexpected error occurred.');
    expect(getErrorMessage({ message: '   ' })).toBe('An unexpected error occurred.');
    expect(getErrorMessage(new Error(''))).toBe('An unexpected error occurred.');
  });

  it('handles non-string message properties safely without throwing', () => {
    expect(getErrorMessage({ message: 12345 })).toBe('An unexpected error occurred.');
    expect(getErrorMessage({ message: null })).toBe('An unexpected error occurred.');
    expect(getErrorMessage({ message: {} })).toBe('An unexpected error occurred.');
  });

  it('handles numbers, booleans, and arrays safely without throwing', () => {
    expect(getErrorMessage(404)).toBe('An unexpected error occurred.');
    expect(getErrorMessage(false)).toBe('An unexpected error occurred.');
    expect(getErrorMessage(['error', 'array'])).toBe('An unexpected error occurred.');
  });
});
