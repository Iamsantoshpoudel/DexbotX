import { z } from 'zod';

export const MESSAGE_KINDS = ['welcome', 'goodbye'] as const;
export type MessageKind = (typeof MESSAGE_KINDS)[number];

export const IMAGE_STYLE_IDS = ['midnight', 'sunset', 'aurora', 'neon', 'ocean', 'minimal'] as const;
export type ImageStyleId = (typeof IMAGE_STYLE_IDS)[number];

export const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'must be a hex color like #5b4bff');
export const snowflake = z.string().regex(/^\d{17,20}$/, 'must be a Discord ID');

const embedSchema = z.strictObject({
  enabled: z.boolean(),
  title: z.string().max(256),
  description: z.string().max(2000),
  color: hexColor,
  footer: z.string().max(200),
});

const imageSchema = z.strictObject({
  enabled: z.boolean(),
  style: z.enum(IMAGE_STYLE_IDS),
  title: z.string().max(40),
  subtitle: z.string().max(100),
  accentColor: hexColor,
  useServerBanner: z.boolean(),
  avatarShape: z.enum(['circle', 'rounded']),
  showMemberCount: z.boolean(),
  /** Object path of an uploaded background in private storage: "<guildId>/<sha256>.jpg". Overrides the server banner. */
  backgroundPath: z
    .string()
    .regex(/^\d{17,20}\/[0-9a-f]{64}\.jpg$/, 'invalid background reference')
    .nullable()
    .default(null),
});

export const messageConfigSchema = z
  .strictObject({
    enabled: z.boolean(),
    channelId: snowflake.nullable(),
    content: z.string().max(2000),
    embed: embedSchema,
    image: imageSchema,
  })
  .refine(
    (c) => !c.enabled || c.content.trim().length > 0 || c.embed.enabled || c.image.enabled,
    { message: 'Turn on at least one of: text, embed or image', path: ['content'] },
  )
  .refine((c) => !c.embed.enabled || c.embed.title.trim().length > 0 || c.embed.description.trim().length > 0, {
    message: 'An embed needs a title or a description',
    path: ['embed', 'title'],
  });

export type MessageConfig = z.infer<typeof messageConfigSchema>;
export type MessageContent = Omit<MessageConfig, 'enabled' | 'channelId'>;

export interface GuildMessages {
  welcome: MessageConfig;
  goodbye: MessageConfig;
}

export function defaultMessageConfig(kind: MessageKind): MessageConfig {
  if (kind === 'welcome') {
    return {
      enabled: false,
      channelId: null,
      content: 'Welcome to **{server}**, {user}! 🎉',
      embed: { enabled: false, title: 'Welcome, {displayName}!', description: 'You are member **{memberCountOrdinal}** of {server}.', color: '#5b4bff', footer: '' },
      image: {
        enabled: true,
        style: 'midnight',
        title: 'Welcome',
        subtitle: 'You are member #{memberCount}',
        accentColor: '#7c6cff',
        useServerBanner: false,
        avatarShape: 'circle',
        showMemberCount: true,
        backgroundPath: null,
      },
    };
  }
  return {
    enabled: false,
    channelId: null,
    content: '**{username}** just left **{server}**. Take care! 👋',
    embed: { enabled: false, title: 'Goodbye, {displayName}', description: 'We are now **{memberCount}** members.', color: '#f97316', footer: '' },
    image: {
      enabled: true,
      style: 'sunset',
      title: 'Goodbye',
      subtitle: 'We will miss you',
      accentColor: '#fb923c',
      useServerBanner: false,
      avatarShape: 'circle',
      showMemberCount: true,
      backgroundPath: null,
    },
  };
}

export function defaultGuildMessages(): GuildMessages {
  return { welcome: defaultMessageConfig('welcome'), goodbye: defaultMessageConfig('goodbye') };
}

/** Parse stored JSON; fall back to defaults when the stored shape is no longer valid. */
export function normalizeMessageConfig(kind: MessageKind, raw: unknown): MessageConfig {
  const parsed = messageConfigSchema.safeParse(raw);
  return parsed.success ? parsed.data : defaultMessageConfig(kind);
}
