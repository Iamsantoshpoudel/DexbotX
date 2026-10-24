import { BadRequestException, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { RedisService } from '../redis/redis.service';

export const featureFlagsSchema = z.object({
  maintenance: z.boolean(),
  musicEnabled: z.boolean(),
  socialEnabled: z.boolean(),
  messageRatePerMinute: z.number().int().min(0).max(1000),
}).strict();

export type FeatureFlags = z.infer<typeof featureFlagsSchema>;

const DEFAULT_FLAGS: FeatureFlags = {
  maintenance: false,
  musicEnabled: false,
  socialEnabled: false,
  messageRatePerMinute: 20,
};
const PUBLIC_FLAGS_CACHE_SECONDS = 30;

@Injectable()
export class FeatureFlagsService {
  constructor(private readonly redis: RedisService) {}

  async get(): Promise<FeatureFlags> {
    const stored = await this.redis.client.hgetall('flags');
    return featureFlagsSchema.parse({
      maintenance: parseBoolean(stored.maintenance, DEFAULT_FLAGS.maintenance),
      musicEnabled: parseBoolean(stored.musicEnabled, DEFAULT_FLAGS.musicEnabled),
      socialEnabled: parseBoolean(stored.socialEnabled, DEFAULT_FLAGS.socialEnabled),
      messageRatePerMinute: stored.messageRatePerMinute === undefined
        ? DEFAULT_FLAGS.messageRatePerMinute
        : Number(stored.messageRatePerMinute),
    });
  }

  async update(flags: FeatureFlags): Promise<void> {
    const validated = this.validate(flags);
    await this.redis.client.hset('flags', {
      maintenance: String(validated.maintenance),
      musicEnabled: String(validated.musicEnabled),
      socialEnabled: String(validated.socialEnabled),
      messageRatePerMinute: String(validated.messageRatePerMinute),
    });
    await this.redis.client.del('flags:public-cache');
  }

  validate(input: unknown): FeatureFlags {
    const result = featureFlagsSchema.safeParse(input);
    if (!result.success) {
      throw new BadRequestException({
        message: 'Invalid feature flags',
        issues: result.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
      });
    }
    return result.data;
  }

  async getPublic(): Promise<Pick<FeatureFlags, 'maintenance'>> {
    const cached = await this.redis.client.get('flags:public-cache');
    if (cached) return JSON.parse(cached) as Pick<FeatureFlags, 'maintenance'>;
    const flags = await this.get();
    const publicFlags = { maintenance: flags.maintenance };
    await this.redis.client.set('flags:public-cache', JSON.stringify(publicFlags), 'EX', PUBLIC_FLAGS_CACHE_SECONDS);
    return publicFlags;
  }
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error('Invalid feature flag boolean in Redis');
}
