import { Inject, Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { Job, UnrecoverableError, Worker } from 'bullmq';
import Redis from 'ioredis';
import { APP_CONFIG, AppConfig } from '../core/config';
import { DiscordApiError, DiscordRestService } from '../discord/discord-rest.service';
import { MetricsService } from '../metrics/metrics.service';
import { MEMBER_EVENTS_QUEUE, MemberEventJob } from '../queue/member-events.queue';
import { SettingsCache } from '../redis/settings-cache.service';
import { AssetFetcher } from '../render/asset-fetcher.service';
import { MessageBuilder } from '../render/message-builder.service';
import { AssetStorage } from '../storage/asset-storage.service';

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
    private readonly metrics: MetricsService,
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
    this.worker.on('completed', (_job, result) => this.metrics.memberEvents.inc({ result }));
    this.worker.on('failed', (job, err) => {
      const final = !job || job.attemptsMade >= (job.opts.attempts ?? 1) || err instanceof UnrecoverableError;
      if (final) this.metrics.memberEvents.inc({ result: 'failed' });
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
        // Missing access/permissions or deleted channel: retrying cannot help.
        if (err.status === 403 || err.status === 404) {
          throw new UnrecoverableError(`Discord refused the post (${err.status}${err.discordCode ? `/${err.discordCode}` : ''})`);
        }
      }
      throw err;
    }
    return 'sent';
  }
}
