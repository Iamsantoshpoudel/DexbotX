import { Inject, Injectable, OnApplicationShutdown } from '@nestjs/common';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { APP_CONFIG, AppConfig } from '../core/config';
import type { MessageKind } from '../shared/message-config';

export const MEMBER_EVENTS_QUEUE = 'member-events';

/**
 * Everything the worker needs that only the gateway knows. Settings are NOT copied here:
 * the worker reads the latest config, so edits made while a job waits still apply.
 */
export interface MemberEventJob {
  kind: MessageKind;
  guildId: string;
  /** Channel already verified by the shard to belong to this server. */
  channelId: string;
  user: { id: string; username: string; displayName: string; avatarUrl: string };
  guild: { name: string; memberCount: number; bannerUrl: string | null };
}

/** Producer side: bot shards enqueue here, the worker process consumes. */
@Injectable()
export class MemberEventsQueue implements OnApplicationShutdown {
  readonly queue: Queue<MemberEventJob>;
  private readonly connection: Redis;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    // BullMQ needs maxRetriesPerRequest = null on its connections.
    this.connection = new Redis(config.redisUrl, { maxRetriesPerRequest: null, enableReadyCheck: false });
    this.connection.on('error', () => undefined); // surfaced through queue calls; avoids unhandled 'error' events
    this.queue = new Queue<MemberEventJob>(MEMBER_EVENTS_QUEUE, {
      connection: this.connection,
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { age: 3600, count: 1000 },
        removeOnFail: { age: 24 * 3600, count: 5000 },
      },
    });
    this.queue.on('error', () => undefined);
  }

  async enqueue(job: MemberEventJob): Promise<void> {
    // The 15s bucket drops duplicate gateway deliveries of the same join/leave.
    const bucket = Math.floor(Date.now() / 15_000);
    await this.queue.add(job.kind, job, { jobId: `${job.kind}-${job.guildId}-${job.user.id}-${bucket}` });
  }

  async onApplicationShutdown(): Promise<void> {
    await this.queue.close();
    this.connection.disconnect();
  }
}
