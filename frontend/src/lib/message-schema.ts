import { z } from 'zod';
import type { MessageConfig } from './types';

/**
 * Mirrors backend/src/shared/message-config.ts so mistakes are caught before a request is made.
 * The server remains the authority; this only gives instant, field-level feedback.
 */
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a colour like #8ab4f8');
const snowflake = z.string().regex(/^\d{17,20}$/, 'Choose a valid channel');

export const BACKGROUND_PATH_RE = /^\d{17,20}\/[0-9a-f]{64}\.jpg$/;

const embedSchema = z.strictObject({
  enabled: z.boolean(),
  title: z.string().max(256, 'Max 256 characters'),
  description: z.string().max(2000, 'Max 2000 characters'),
  color: hex,
  footer: z.string().max(200, 'Max 200 characters'),
});

const imageSchema = z.strictObject({
  enabled: z.boolean(),
  style: z.enum(['midnight', 'sunset', 'aurora', 'neon', 'ocean', 'minimal']),
  title: z.string().max(40, 'Max 40 characters'),
  subtitle: z.string().max(100, 'Max 100 characters'),
  accentColor: hex,
  useServerBanner: z.boolean(),
  avatarShape: z.enum(['circle', 'rounded']),
  showMemberCount: z.boolean(),
  backgroundPath: z.string().regex(BACKGROUND_PATH_RE, 'Invalid background reference').nullable(),
});

export const messageConfigSchema = z
  .strictObject({
    enabled: z.boolean(),
    channelId: snowflake.nullable(),
    content: z.string().max(2000, 'Max 2000 characters'),
    embed: embedSchema,
    image: imageSchema,
  })
  .superRefine((c, ctx) => {
    if (c.enabled && !c.channelId) {
      ctx.addIssue({ code: 'custom', path: ['channelId'], message: 'Choose a channel to turn this on.' });
    }
    if (c.enabled && !c.content.trim() && !c.embed.enabled && !c.image.enabled) {
      ctx.addIssue({ code: 'custom', path: ['content'], message: 'Turn on at least one of: text, embed or image.' });
    }
    if (c.embed.enabled && !c.embed.title.trim() && !c.embed.description.trim()) {
      ctx.addIssue({ code: 'custom', path: ['embed', 'title'], message: 'An embed needs a title or a description.' });
    }
  });

export type FieldIssues = Record<string, string>;

/** Returns `{}` when valid, otherwise the first message per field path, e.g. `{ 'image.title': 'Max 40 characters' }`. */
export function validateMessage(config: MessageConfig): FieldIssues {
  const result = messageConfigSchema.safeParse(config);
  if (result.success) return {};
  const issues: FieldIssues = {};
  for (const issue of result.error.issues) {
    const path = issue.path.join('.');
    issues[path] ??= issue.message;
  }
  return issues;
}

/** Maps a field path to the DOM id of its input, so the first invalid field can be focused. */
export const FIELD_IDS: Record<string, string> = {
  channelId: 'channel',
  content: 'content',
  'image.title': 'img-title',
  'image.subtitle': 'img-sub',
  'image.accentColor': 'img-accent',
  'embed.title': 'emb-title',
  'embed.description': 'emb-desc',
  'embed.color': 'emb-color',
  'embed.footer': 'emb-footer',
};
