import { describe, expect, it } from 'vitest';
import { parseRetryAfter, rateLimitMessage } from './rate-limit';

describe('rate limit helpers', () => {
  it('parses Retry-After seconds and ignores junk', () => {
    expect(parseRetryAfter('12')).toBe(12);
    expect(parseRetryAfter(' 7 ')).toBe(7);
    expect(parseRetryAfter('1.2')).toBe(2);
    expect(parseRetryAfter('0')).toBe(0);
    expect(parseRetryAfter('-5')).toBeNull();
    expect(parseRetryAfter('Wed, 21 Oct 2026 07:28:00 GMT')).toBeNull();
    expect(parseRetryAfter('')).toBeNull();
    expect(parseRetryAfter(null)).toBeNull();
  });

  it('words the message with or without a wait time', () => {
    expect(rateLimitMessage(12)).toBe('Too many requests. Try again in 12s.');
    expect(rateLimitMessage(null)).toMatch(/wait a moment/i);
  });
});
