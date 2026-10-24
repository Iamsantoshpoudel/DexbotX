import { Inject, Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { Job, UnrecoverableError, Worker } from 'bullmq';
import Redis from 'ioredis';
import { APP_CONFIG, AppConfig } from '../core/config';
import { ChannelAccessService } from '../discord/channel-access.service';
import { DiscordApiError, DiscordRestService } from '../discord/discord-rest.service';
import { MetricsService } from '../metrics/metrics.service';
import { MEMBER_EVENTS_QUEUE, MemberEventJob } from '../queue/member-events.queue';
import { SettingsCache } from '../redis/settings-cache.service';
import { AssetFetcher } from '../render/asset-fetcher.service';
import { MessageBuilder } from '../render/message-builder.service';
import { AssetStorage } from '../storage/asset-storage.service';
import { StatsService } from '../admin/stats.service';
import { DatabaseService } from '../db/database.service';
import { guilds } from '../db/schema';
import { eq } from 'drizzle-orm';

/** A welcome that is this late is more confusing than helpful. */
const MAX_JOB_AGE_MS = 30 * 60 * 1000;

export type JobResult = 'sent' | 'skipped-disabled' | 'skipped-stale';

/**
 * Consumes member-events jobs: loads the latest settings, renders the card, posts through the REST API.
 * Runs in its own process, so CPU-heavy rendering never blocks the gateway connection.
 */
@Injectable()
export class MemberEventsProcessor implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(MemberEventsProcessor.name);
  private worker?: Worker<MemberEventJob, JobResult>;
  private connection?: Redis;

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly settings: SettingsCache,
    private readonly builder: MessageBuilder,
    private readonly assets: AssetFetcher,
    private readonly storage: AssetStorage,
    private readonly discord: DiscordRestService,
    private readonly channelAccess: ChannelAccessService,
    private readonly metrics: MetricsService,
    private readonly stats: StatsService,
    private readonly database: DatabaseService,
  ) {}

  onApplicationBootstrap(): void {
    this.connection = new Redis(this.config.redisUrl, { maxRetriesPerRequest: null });
    this.connection.on('error', (err) => this.logger.error(`Redis error: ${err.message}`));
    this.worker = new Worker<MemberEventJob, JobResult>(MEMBER_EVENTS_QUEUE, (job) => this.process(job), {
      connection: this.connection,
      concurrency: this.config.workerConcurrency,
      // Global cap across all workers; Discord's own per-channel limits are handled by 429 back-off below.
      limiter: { max: 40, duration: 1000 },
    });
    this.worker.on('completed', (job, result) => {
      this.metrics.memberEvents.inc({ result });
      if (result === 'sent') {
        void this.stats.incr('msg_sent');
        void this.database.db.update(guilds)
          .set({ lastMessageAt: new Date() })
          .where(eq(guilds.id, job.data.guildId))
          .catch((error: unknown) => this.logger.warn(`Could not record last message time: ${error instanceof Error ? error.message : String(error)}`));
      }
    });
    this.worker.on('failed', (job, err) => {
      const final = !job || job.attemptsMade >= (job.opts.attempts ?? 1) || err instanceof UnrecoverableError;
      if (final) {
        this.metrics.memberEvents.inc({ result: 'failed' });
        void this.stats.incr('msg_failed');
        if (job) {
          void this.stats.pushEvent('failed_posts', {
            guildId: job.data.guildId,
            kind: job.data.kind,
            reason: err.message,
            at: new Date().toISOString(),
          });
        }
      }
      this.logger.warn(`Job ${job?.id} failed (attempt ${job?.attemptsMade}): ${err.message}`);
    });
    this.worker.on('error', (err) => this.logger.error(`Worker error: ${err.message}`));
    this.logger.log(`Worker started (concurrency ${this.config.workerConcurrency})`);
  }

  async onApplicationShutdown(): Promise<void> {
    // Waits for in-flight jobs, so a deploy never drops a half-sent welcome.
    await this.worker?.close();
    this.connection?.disconnect();
  }

  async process(job: Job<MemberEventJob, JobResult>): Promise<JobResult> {
    const { kind, guildId, channelId, user, guild } = job.data;
    if (Date.now() - job.timestamp > MAX_JOB_AGE_MS) return 'skipped-stale';

    const config = (await this.settings.get(guildId))[kind];
    // Re-check against the latest settings: the feature may have been turned off or moved while the job waited.
    if (!config.enabled || config.channelId !== channelId) return 'skipped-disabled';

    const wantsImage = config.image.enabled;
    const [avatar, banner, background] = await Promise.all([
      wantsImage ? this.assets.fetch(user.avatarUrl) : null,
      wantsImage && config.image.useServerBanner ? this.assets.fetch(guild.bannerUrl) : null,
      wantsImage && config.image.backgroundPath ? this.storage.get(config.image.backgroundPath) : null,
    ]);

    const message = await this.builder.build(
      config,
      { userId: user.id, username: user.username, displayName: user.displayName, serverName: guild.name, memberCount: guild.memberCount },
      { avatar, banner, background },
    );

    try {
      await this.discord.createMessage(channelId, message, kind === 'welcome' ? [user.id] : []);
    } catch (err) {
      if (err instanceof DiscordApiError) {
        if (err.status === 429) {
          const wait = Math.ceil((err.retryAfter ?? 1) * 1000);
          await this.worker?.rateLimit(wait);
          throw Worker.RateLimitError();
        }
        if (err.status === 403 && (err.discordCode === 50013 || err.discordCode === 50001)) {
          const result = await this.channelAccess.ensureChannelAccess(guildId, channelId);
          if (result === 'fixed') {
            try {
              await this.discord.createMessage(channelId, message, kind === 'welcome' ? [user.id] : []);
            } catch (retryError) {
              await this.handleDiscordPostError(retryError);
            }
            return 'sent';
          }
        }
        // Missing access/permissions or deleted channel: retrying cannot help.
        if (err.status === 403 || err.status === 404) {
          throw new UnrecoverableError(`Discord refused the post (${err.status}${err.discordCode ? `/${err.discordCode}` : ''})`);
        }
      }
      throw err;
    }
    return 'sent';
  }

  private async handleDiscordPostError(err: unknown): Promise<never> {
    if (err instanceof DiscordApiError) {
      if (err.status === 429) {
        const wait = Math.ceil((err.retryAfter ?? 1) * 1000);
        await this.worker?.rateLimit(wait);
        throw Worker.RateLimitError();
      }
      if (err.status === 403 || err.status === 404) {
        throw new UnrecoverableError(`Discord refused the post (${err.status}${err.discordCode ? `/${err.discordCode}` : ''})`);
      }
    }
    throw err;
  }
}
