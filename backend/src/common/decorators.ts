import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { AuthedRequest, SessionData } from './types';

export const PUBLIC_KEY = 'dexbotx:public';
export const RATE_LIMIT_KEY = 'dexbotx:rate-limit';

/** Route does not require a logged-in user. */
export const Public = () => SetMetadata(PUBLIC_KEY, true);

export interface RateLimitMeta {
  name: string;
  limit: number;
  windowSeconds: number;
}

/** Per-route rate limit, keyed by user (or IP when anonymous). Replaces the default limit for that route. */
export const RateLimit = (name: string, limit: number, windowSeconds = 60) =>
  SetMetadata(RATE_LIMIT_KEY, { name, limit, windowSeconds } satisfies RateLimitMeta);

export const CurrentSession = createParamDecorator((_data: unknown, ctx: ExecutionContext): SessionData => {
  return ctx.switchToHttp().getRequest<AuthedRequest>().session as SessionData;
});
