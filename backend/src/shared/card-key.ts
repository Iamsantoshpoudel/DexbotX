import { createHash } from 'node:crypto';
import type { MessageConfig } from './message-config';

export const RENDER_VERSION = '1';

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

export function createCardKey(image: MessageConfig['image'], avatarHash: string | null, bannerHash: string | null): string {
  const input = `${RENDER_VERSION}${stableStringify(image)}${avatarHash ?? ''}${bannerHash ?? ''}${image.backgroundPath ?? ''}`;
  return createHash('sha256').update(input).digest('hex');
}
