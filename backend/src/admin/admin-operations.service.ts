import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Job } from 'bullmq';
import { and, count, eq, ilike, or } from 'drizzle-orm';
import { DatabaseService } from '../db/database.service';
import { guildChannels, guildSettings, guilds } from '../db/schema';
import { DiscordApiError, DiscordRestService } from '../discord/discord-rest.service';
import { MemberEventsQueue, type MemberEventJob } from '../queue/member-events.queue';
import { defaultGuildMessages } from '../shared/message-config';
import { RedisService } from '../redis/redis.service';
import { SettingsCache } from '../redis/settings-cache.service';
import { AdminAuditService } from './admin-audit.service';
import { StatsService } from './stats.service';

interface FailedPost {
  guildId?: string;
  kind?: string;
  reason?: string;
  at?: string;
}

@Injectable()
export class AdminOperationsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly redis: RedisService,
    private readonly discord: DiscordRestService,
    private readonly settings: SettingsCache,
    private readonly stats: StatsService,
    private readonly audit: AdminAuditService,
    private readonly memberEventsQueue: MemberEventsQueue,
  ) {}

  async listGuilds(search = '', pageInput = 1) {
    const page = Number.isFinite(pageInput) ? Math.max(1, Math.floor(pageInput)) : 1;
    const normalizedSearch = search.trim().slice(0, 100);
    const filter = normalizedSearch
      ? or(ilike(guilds.name, `%${normalizedSearch}%`), ilike(guilds.id, `%${normalizedSearch}%`))
      : undefined;
    const [records, countRows] = await Promise.all([
      this.database.db
        .select({
          id: guilds.id,
          name: guilds.name,
          memberCount: guilds.memberCount,
          ownerId: guilds.ownerId,
          joinedAt: guilds.joinedAt,
          lastMessageAt: guilds.lastMessageAt,
          welcomeEnabled: guildSettings.welcome,
          goodbyeEnabled: guildSettings.goodbye,
        })
        .from(guilds)
        .leftJoin(guildSettings, eq(guildSettings.guildId, guilds.id))
        .where(and(eq(guilds.installed, true), filter))
        .orderBy(guilds.name)
        .limit(25)
        .offset((page - 1) * 25),
      this.database.db
        .select({ total: count() })
        .from(guilds)
        .where(and(eq(guilds.installed, true), filter)),
    ]);
    const total = Number(countRows[0]?.total ?? 0);
    return {
      guilds: records.map((record) => ({
        ...record,
        welcomeEnabled: record.welcomeEnabled?.enabled ?? false,
        goodbyeEnabled: record.goodbyeEnabled?.enabled ?? false,
      })),
      page,
      total,
      pages: Math.ceil(total / 25),
    };
  }

  async guildDetail(guildId: string) {
    const [rows, channels, errors] = await Promise.all([
      this.database.db
        .select({
          id: guilds.id,
          name: guilds.name,
          memberCount: guilds.memberCount,
          ownerId: guilds.ownerId,
          joinedAt: guilds.joinedAt,
          lastMessageAt: guilds.lastMessageAt,
          welcome: guildSettings.welcome,
          goodbye: guildSettings.goodbye,
        })
        .from(guilds)
        .leftJoin(guildSettings, eq(guildSettings.guildId, guilds.id))
        .where(eq(guilds.id, guildId))
        .limit(1),
      this.database.db
        .select({ id: guildChannels.id, name: guildChannels.name, type: guildChannels.type })
        .from(guildChannels)
        .where(eq(guildChannels.guildId, guildId)),
      this.stats.events('failed_posts'),
    ]);
    const guild = rows[0];
    if (!guild) throw new NotFoundException('Guild not found');

    const configs = [
      { kind: 'welcome' as const, config: guild.welcome },
      { kind: 'goodbye' as const, config: guild.goodbye },
    ];
    const configuredChannels = await Promise.all(configs.map(async ({ kind, config }) => {
      if (!config?.channelId) {
        return { kind, enabled: config?.enabled ?? false, channelId: null, channelName: null, canBotPost: null };
      }
      const channel = channels.find((candidate) => candidate.id === config.channelId);
      return {
        kind,
        enabled: config.enabled,
        channelId: config.channelId,
        channelName: channel?.name ?? null,
        canBotPost: channel ? await this.cachedCanBotPost(channel.id) : false,
      };
    }));

    return {
      guild: {
        id: guild.id,
        name: guild.name,
        memberCount: guild.memberCount,
        ownerId: guild.ownerId,
        joinedAt: guild.joinedAt,
        lastMessageAt: guild.lastMessageAt,
      },
      channels: configuredChannels,
      recentErrors: errors
        .filter((event): event is FailedPost => isFailedPost(event) && event.guildId === guildId)
        .map(({ guildId: failedGuildId, kind, reason, at }) => ({
          guildId: failedGuildId,
          kind,
          reason: mapFailureReason(reason ?? ''),
          at,
        }))
        .slice(0, 20),
    };
  }

  async resyncGuild(adminId: string, guildId: string): Promise<{ ok: true }> {
    const channelRows = await this.database.db
      .select({ id: guildChannels.id })
      .from(guildChannels)
      .where(eq(guildChannels.guildId, guildId));
    const keys = [
      ...channelRows.map(({ id }) => `chan:${id}`),
      `guild:${guildId}:channels`,
      `guild:${guildId}:meta`,
      `discord:cache:channels:${guildId}`,
      `discord:cache:system-channel:${guildId}`,
      `guild:${guildId}:roles`,
    ];
    await this.redis.client.del(...keys);
    await this.audit.log(adminId, 'guild.resync', guildId, { clearedChannelCaches: channelRows.length });
    return { ok: true };
  }

  async disableGuild(adminId: string, guildId: string): Promise<{ ok: true }> {
    const existing = await this.database.db.select().from(guilds).where(eq(guilds.id, guildId)).limit(1);
    if (!existing.length) throw new NotFoundException('Guild not found');
    const defaults = defaultGuildMessages();
    const settings = await this.database.db.select().from(guildSettings).where(eq(guildSettings.guildId, guildId)).limit(1);
    const welcome = { ...(settings[0]?.welcome ?? defaults.welcome), enabled: false };
    const goodbye = { ...(settings[0]?.goodbye ?? defaults.goodbye), enabled: false };
    await this.database.db
      .insert(guildSettings)
      .values({ guildId, welcome, goodbye, updatedBy: adminId, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: guildSettings.guildId,
        set: { welcome, goodbye, updatedBy: adminId, updatedAt: new Date() },
      });
    await this.settings.invalidate(guildId);
    await this.audit.log(adminId, 'guild.disable', guildId, { welcome: false, goodbye: false });
    return { ok: true };
  }

  async leaveGuild(adminId: string, guildId: string, confirm: string): Promise<{ ok: true }> {
    const rows = await this.database.db.select({ id: guilds.id, name: guilds.name }).from(guilds).where(eq(guilds.id, guildId)).limit(1);
    const guild = rows[0];
    if (!guild) throw new NotFoundException('Guild not found');
    if (confirm !== guild.name) throw new BadRequestException('Confirmation must exactly match the server name');
    await this.discord.leaveGuild(guildId);
    await this.database.db.update(guilds).set({ installed: false, leftAt: new Date(), updatedAt: new Date() }).where(eq(guilds.id, guildId));
    await this.redis.client.del(
      `guild:${guildId}:meta`,
      `guild:${guildId}:channels`,
      `discord:cache:channels:${guildId}`,
      `discord:cache:system-channel:${guildId}`,
    );
    await this.audit.log(adminId, 'guild.leave', guildId, { name: guild.name });
    return { ok: true };
  }

  async failures() {
    const jobs = await this.memberEventsQueue.queue.getJobs(['failed'], 0, 99, true);
    return jobs.map((job) => ({
      id: job.id ?? '',
      kind: job.data.kind,
      guildId: job.data.guildId,
      reason: mapFailureReason(job.failedReason ?? ''),
      time: new Date(job.finishedOn ?? job.timestamp).toISOString(),
    }));
  }

  async retryFailure(adminId: string, jobId: string): Promise<{ ok: true }> {
    const job = await this.memberEventsQueue.queue.getJob(jobId);
    if (!job || await job.getState() !== 'failed') throw new NotFoundException('Failed job not found');
    const target = safeJobTarget(job);
    await job.retry();
    await this.audit.log(adminId, 'failure.retry', jobId, target);
    return { ok: true };
  }

  async clearFailures(adminId: string, confirm: boolean): Promise<{ cleared: number }> {
    if (confirm !== true) throw new BadRequestException('Confirmation is required');
    const jobs = await this.memberEventsQueue.queue.getJobs(['failed'], 0, -1, true);
    for (const job of jobs) await job.remove();
    await this.audit.log(adminId, 'failures.clear', 'all', { count: jobs.length });
    return { cleared: jobs.length };
  }

  private async cachedCanBotPost(channelId: string): Promise<boolean> {
    const key = `admin:can-post:${channelId}`;
    const cached = await this.redis.client.get(key);
    if (cached !== null) return cached === '1';
    try {
      const canPost = await this.discord.canBotPost(channelId);
      await this.redis.client.set(key, canPost ? '1' : '0', 'EX', 60);
      return canPost;
    } catch (error) {
      if (error instanceof DiscordApiError && (error.status === 403 || error.status === 404)) {
        await this.redis.client.set(key, '0', 'EX', 60);
        return false;
      } else {
        throw error;
      }
    }
  }
}

function isFailedPost(value: unknown): value is FailedPost {
  return typeof value === 'object' && value !== null;
}

function mapFailureReason(reason: string): 'missing permission' | 'deleted channel' | 'render error' | 'other' {
  if (/50013|50001|permission|access denied/i.test(reason)) return 'missing permission';
  if (/10003|unknown channel|channel.*deleted|not found/i.test(reason)) return 'deleted channel';
  if (/render|canvas|image generation/i.test(reason)) return 'render error';
  return 'other';
}

function safeJobTarget(job: Job<MemberEventJob>): Record<string, unknown> {
  return { guildId: job.data.guildId, kind: job.data.kind };
}
