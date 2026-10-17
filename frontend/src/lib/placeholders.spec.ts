import { describe, expect, it } from 'vitest';
import { applyPlaceholders, ordinal } from './placeholders';

const ctx = { userId: '123456789012345678', username: 'ali*ce', displayName: 'Alice', serverName: 'Dex HQ', memberCount: 1021 };

describe('applyPlaceholders', () => {
  it('renders a mention for messages and plain text for images', () => {
    expect(applyPlaceholders('{user}', ctx, 'message')).toBe('<@123456789012345678>');
    expect(applyPlaceholders('{user}', ctx, 'image')).toBe('Alice');
  });
  it('escapes markdown in names for messages only', () => {
    expect(applyPlaceholders('{username}', ctx, 'message')).toBe('ali\\*ce');
    expect(applyPlaceholders('{username}', ctx, 'image')).toBe('ali*ce');
  });
  it('defuses @everyone in server names', () => {
    const out = applyPlaceholders('{server}', { ...ctx, serverName: '@everyone' }, 'message');
    expect(out).not.toContain('@everyone');
  });
  it('leaves unknown placeholders alone', () => {
    expect(applyPlaceholders('{nope} {server}', ctx, 'image')).toBe('{nope} Dex HQ');
  });
  it('formats ordinals', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 101, 1021].map(ordinal)).toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '101st', '1,021st']);
  });
});
