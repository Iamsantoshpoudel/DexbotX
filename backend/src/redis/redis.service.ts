import { Inject, Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import Redis, { type RedisOptions } from 'ioredis';
import { APP_CONFIG, AppConfig } from '../core/config';

type MessageHandler = (channel: string, message: string) => void;

@Injectable()
export class RedisService implements OnApplicationShutdown {
  private readonly logger = new Logger(RedisService.name);
  private readonly role: string;
  readonly client: Redis;
  private subscriber?: Redis;
  private readonly channelHandlers = new Map<string, Set<MessageHandler>>();
  private readonly patternHandlers = new Map<string, Set<MessageHandler>>();

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {
    this.role = process.env.DEXBOTX_PROCESS_ROLE ?? (process.env.SHARD_ID ? `shard${process.env.SHARD_ID}` : 'api');
    this.client = this.connect(`${this.role}:main`, { maxRetriesPerRequest: this.role === 'worker' ? null : 3 });
    const expectedConnections = this.role === 'worker' ? 4 : 2;
    this.logger.log(`Redis connections expected: ${expectedConnections} (${this.role})`);
  }

  private retryStrategy(times: number): number {
    return Math.min(100 * 2 ** Math.min(times - 1, 7), 10_000);
  }

  private connect(connectionName: string, options: RedisOptions): Redis {
    const redis = new Redis(this.config.redisUrl, {
      ...options,
      connectionName,
      retryStrategy: (times) => this.retryStrategy(times),
    });
    redis.on('error', (err) => this.logger.error(`Redis error: ${err.message}`));
    return redis;
  }

  private getSubscriber(): Redis {
    if (!this.subscriber) {
      this.subscriber = this.connect(`${this.role}:sub`, { maxRetriesPerRequest: 3 });
      this.subscriber.on('message', (channel, message) => this.dispatch(this.channelHandlers, channel, channel, message));
      this.subscriber.on('pmessage', (pattern, channel, message) =>
        this.dispatch(this.patternHandlers, pattern, channel, message),
      );
    }
    return this.subscriber;
  }

  async subscribe(channel: string, handler: MessageHandler): Promise<void> {
    const handlers = this.channelHandlers.get(channel) ?? new Set<MessageHandler>();
    handlers.add(handler);
    this.channelHandlers.set(channel, handlers);
    await this.getSubscriber().subscribe(channel);
  }

  async psubscribe(pattern: string, handler: MessageHandler): Promise<void> {
    const handlers = this.patternHandlers.get(pattern) ?? new Set<MessageHandler>();
    handlers.add(handler);
    this.patternHandlers.set(pattern, handlers);
    await this.getSubscriber().psubscribe(pattern);
  }

  async connectedClients(): Promise<number> {
    const info = await this.client.info('clients');
    const match = /^connected_clients:(\d+)$/m.exec(info);
    if (!match) throw new Error('Redis INFO clients did not include connected_clients');
    return Number(match[1]);
  }

  private dispatch(
    handlersByKey: Map<string, Set<MessageHandler>>,
    key: string,
    channel: string,
    message: string,
  ): void {
    for (const handler of handlersByKey.get(key) ?? []) {
      try {
        handler(channel, message);
      } catch (error) {
        this.logger.error(`Redis subscriber handler failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  async onApplicationShutdown(): Promise<void> {
    const clients = [this.client, this.subscriber].filter((client): client is Redis => Boolean(client));
    const results = await Promise.allSettled(clients.map((client) => client.quit()));
    for (const result of results) {
      if (result.status === 'rejected') {
        this.logger.error(`Redis shutdown failed: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`);
      }
    }
  }
}
