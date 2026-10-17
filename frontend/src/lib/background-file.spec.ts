import { describe, expect, it } from 'vitest';
import { checkBackgroundFile, MAX_BACKGROUND_BYTES } from './background-file';

describe('checkBackgroundFile', () => {
  it('accepts png, jpeg and webp up to 2 MB', () => {
    for (const type of ['image/png', 'image/jpeg', 'image/webp']) expect(checkBackgroundFile({ type, size: 1000 })).toBeNull();
    expect(checkBackgroundFile({ type: 'image/png', size: MAX_BACKGROUND_BYTES })).toBeNull();
  });
  it('rejects other types, empty and oversized files', () => {
    expect(checkBackgroundFile({ type: 'image/gif', size: 1000 })).toMatch(/PNG, JPEG or WebP/);
    expect(checkBackgroundFile({ type: 'image/svg+xml', size: 1000 })).not.toBeNull();
    expect(checkBackgroundFile({ type: 'application/pdf', size: 1000 })).not.toBeNull();
    expect(checkBackgroundFile({ type: 'image/png', size: 0 })).toMatch(/empty/);
    expect(checkBackgroundFile({ type: 'image/png', size: MAX_BACKGROUND_BYTES + 1 })).toMatch(/2 MB/);
  });
});
