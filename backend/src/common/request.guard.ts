import { CanActivate, ExecutionContext, ForbiddenException, HttpException, HttpStatus, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Response } from 'express';
import { sessionCookieName } from '../auth/cookies';
import { SessionService } from '../auth/session.service';
import { APP_CONFIG, AppConfig } from '../core/config';
import { RateLimiter } from '../redis/rate-limiter.service';
import { PUBLIC_KEY, RATE_LIMIT_KEY, RateLimitMeta } from './decorators';
import type { AuthedRequest } from './types';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const DEFAULT_LIMIT: RateLimitMeta = { name: 'default', limit: 300, windowSeconds: 60 };

function originOf(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    return new URL(value).origin;
  } catch {
    return undefined;
  }
}

/**
 * Global guard, in this order:
 *  1. load the session from the cookie
 *  2. CSRF: state-changing requests must come from the dashboard origin
 *  3. rate limit (per user, or per IP when anonymous)
 *  4. require a session unless the route is @Public()
 */
@Injectable()
export class RequestGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionService,
    private readonly limiter: RateLimiter,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;
    const http = context.switchToHttp();
    const req = http.getRequest<AuthedRequest>();
    const res = http.getResponse<Response>();

    const sid = req.cookies?.[sessionCookieName(this.config)];
    if (typeof sid === 'string' && sid) {
      const session = await this.sessions.get(sid);
      if (session) {
        req.session = session;
        req.sid = sid;
      }
    }

    if (!SAFE_METHODS.has(req.method)) {
      const origin = req.get('origin') ?? originOf(req.get('referer'));
      if (origin !== this.config.webOrigin) throw new ForbiddenException('Cross-site request blocked');
    }

    const meta =
      this.reflector.getAllAndOverride<RateLimitMeta | undefined>(RATE_LIMIT_KEY, [context.getHandler(), context.getClass()]) ??
      DEFAULT_LIMIT;
    const id = req.session?.userId ?? req.ip ?? 'unknown';
    const result = await this.limiter.hit(`${meta.name}:${id}`, meta.limit, meta.windowSeconds);
    res.setHeader('RateLimit-Remaining', String(result.remaining));
    if (!result.allowed) {
      res.setHeader('Retry-After', String(result.retryAfterSeconds));
      throw new HttpException(
        { statusCode: HttpStatus.TOO_MANY_REQUESTS, message: `Too many requests. Try again in ${result.retryAfterSeconds}s.` },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(PUBLIC_KEY, [context.getHandler(), context.getClass()]);
    if (!isPublic && !req.session) throw new UnauthorizedException('Log in with Discord to continue');
    return true;
  }
}
