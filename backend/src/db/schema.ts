import { bigserial, boolean, index, integer, jsonb, pgTable, primaryKey, text, timestamp } from 'drizzle-orm/pg-core';
import type { MessageConfig } from '../shared/message-config';

/** Servers the bot is (or was) in. Written by the bot, read by the API. */
export const guilds = pgTable('guilds', {
  id: text('guild_id').primaryKey(),
  name: text('name').notNull(),
  iconHash: text('icon'),
  bannerHash: text('banner_hash'),
  ownerId: text('owner_id'),
  memberCount: integer('member_count').notNull().default(0),
  installed: boolean('bot_present').notNull().default(true),
  joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
  leftAt: timestamp('left_at', { withTimezone: true }),
  lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
  lastMessageAt: timestamp('last_message_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}).enableRLS();

/** One row per server. Welcome and goodbye configs are validated JSON documents. */
export const guildSettings = pgTable('guild_settings', {
  guildId: text('guild_id')
    .primaryKey()
    .references(() => guilds.id),
  welcome: jsonb('welcome').$type<MessageConfig>().notNull(),
  goodbye: jsonb('goodbye').$type<MessageConfig>().notNull(),
  updatedBy: text('updated_by'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}).enableRLS();

export const guildChannels = pgTable(
  'guild_channels',
  {
    guildId: text('guild_id').notNull().references(() => guilds.id),
    id: text('id').notNull(),
    name: text('name').notNull(),
    type: integer('type').notNull(),
    parentId: text('parent_id'),
    position: integer('position').notNull(),
  },
  (t) => [primaryKey({ columns: [t.guildId, t.id] }), index('guild_channels_guild_type_idx').on(t.guildId, t.type)],
).enableRLS();

export const guildRoles = pgTable(
  'guild_roles',
  {
    guildId: text('guild_id').notNull().references(() => guilds.id),
    id: text('id').notNull(),
    name: text('name').notNull(),
    color: integer('color').notNull().default(0),
    position: integer('position').notNull(),
  },
  (t) => [primaryKey({ columns: [t.guildId, t.id] }), index('guild_roles_guild_position_idx').on(t.guildId, t.position)],
).enableRLS();

export const guildTemplates = pgTable(
  'guild_templates',
  {
    guildId: text('guild_id').notNull().references(() => guilds.id),
    id: text('id').notNull(),
    name: text('name').notNull(),
    config: jsonb('config').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.guildId, t.id] }), index('guild_templates_guild_idx').on(t.guildId)],
).enableRLS();

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

export const adminAudit = pgTable(
  'admin_audit',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    adminId: text('admin_id').notNull(),
    action: text('action').notNull(),
    target: text('target').notNull(),
    details: jsonb('details').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('admin_audit_created_idx').on(t.createdAt)],
).enableRLS();

export type GuildRow = typeof guilds.$inferSelect;
