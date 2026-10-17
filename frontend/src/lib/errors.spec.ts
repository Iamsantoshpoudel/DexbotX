import { describe, expect, it } from 'vitest';
import { errorBody, errorMessage, errorStatus, isRateLimited, issuesByPath } from './errors';

describe('errors', () => {
  it('reads the backend body and joins array messages', () => {
    expect(errorBody({ status: 400, data: { statusCode: 400, message: 'Nope' } })?.message).toBe('Nope');
    expect(errorBody({ status: 400, data: { statusCode: 400, message: ['a', 'b'] } })?.message).toBe('a b');
    expect(errorBody({ status: 500, data: 'plain' })).toBeNull();
    expect(errorBody(undefined)).toBeNull();
  });

  it('prefers the server message and falls back sensibly', () => {
    expect(errorMessage({ status: 403, data: { statusCode: 403, message: 'No access' } })).toBe('No access');
    expect(errorMessage({ status: 500 }, 'fallback')).toBe('fallback');
    expect(errorMessage({ status: 'FETCH_ERROR', error: 'TypeError' })).toMatch(/network/i);
    expect(errorMessage({ status: 413 })).toMatch(/too large/i);
    expect(errorMessage({ status: 429 })).toMatch(/too many/i);
  });

  it('does not show a generic message when field issues are present', () => {
    const err = { status: 400, data: { statusCode: 400, message: 'Validation failed', issues: [{ path: 'image.title', message: 'Max 40 characters' }] } };
    expect(errorMessage(err, 'fallback')).toBe('Validation failed');
    expect(issuesByPath(errorBody(err))).toEqual({ 'image.title': 'Max 40 characters' });
  });

  it('keeps the first issue per path', () => {
    const body = { statusCode: 400, message: 'x', issues: [{ path: 'content', message: 'first' }, { path: 'content', message: 'second' }] };
    expect(issuesByPath(body)).toEqual({ content: 'first' });
    expect(issuesByPath(null)).toEqual({});
  });

  it('reads status codes and detects rate limiting', () => {
    expect(errorStatus({ status: 404 })).toBe(404);
    expect(errorStatus({ status: 'FETCH_ERROR' })).toBeNull();
    expect(isRateLimited({ status: 429 })).toBe(true);
    expect(isRateLimited({ status: 500 })).toBe(false);
  });
});
