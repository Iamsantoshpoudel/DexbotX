import { bigserial, boolean, index, integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import type { MessageConfig } from '../shared/message-config';

/** Servers the bot is (or was) in. Written by the bot, read by the API. */
export const guilds = pgTable('guilds', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  iconHash: text('icon_hash'),
  bannerHash: text('banner_hash'),
  ownerId: text('owner_id'),
  memberCount: integer('member_count').notNull().default(0),
  installed: boolean('installed').notNull().default(true),
  joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
  leftAt: timestamp('left_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}).enableRLS();

/** One row per server. Welcome and goodbye configs are validated JSON documents. */
export const guildSettings = pgTable('guild_settings', {
  guildId: text('guild_id')
    .primaryKey()
    .references(() => guilds.id, { onDelete: 'cascade' }),
  welcome: jsonb('welcome').$type<MessageConfig>().notNull(),
  goodbye: jsonb('goodbye').$type<MessageConfig>().notNull(),
  updatedBy: text('updated_by'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}).enableRLS();

/** Who changed what, for support and abuse investigation. */
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    guildId: text('guild_id').notNull(),
    userId: text('user_id').notNull(),
    action: text('action').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('audit_logs_guild_created_idx').on(t.guildId, t.createdAt)],
).enableRLS();

export type GuildRow = typeof guilds.$inferSelect;
