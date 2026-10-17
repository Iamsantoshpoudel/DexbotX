import { Controller, Get, HttpCode, Inject, Post, Query, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentSession, Public, RateLimit } from '../common/decorators';
import type { AuthedRequest, SessionData } from '../common/types';
import { APP_CONFIG, AppConfig } from '../core/config';
import { userAvatarUrl } from '../shared/discord-cdn';
import { AuthService } from './auth.service';
import { cookieOptions, sessionCookieName, stateCookieName } from './cookies';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @Public()
  @RateLimit('auth-login', 20)
  @Get('login')
  async login(@Query('returnTo') returnTo: string | undefined, @Res() res: Response): Promise<void> {
    const { url, state } = await this.auth.startLogin(returnTo);
    res.cookie(stateCookieName(this.config), state, cookieOptions(this.config, 600));
    res.redirect(302, url);
  }

  @Public()
  @RateLimit('auth-callback', 30)
  @Get('callback')
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Req() req: AuthedRequest,
    @Res() res: Response,
  ): Promise<void> {
    const web = this.config.webOrigin;
    const stateCookie = stateCookieName(this.config);
    res.clearCookie(stateCookie, { ...cookieOptions(this.config, 0), maxAge: undefined });

    if (error) return res.redirect(302, `${web}/?error=${error === 'access_denied' ? 'access_denied' : 'login_failed'}`);
    if (typeof code !== 'string' || typeof state !== 'string' || code.length > 512 || state.length > 128) {
      return res.redirect(302, `${web}/?error=login_failed`);
    }
    try {
      const { sid, ttlSeconds, returnTo } = await this.auth.finishLogin(code, state, req.cookies?.[stateCookie]);
      res.cookie(sessionCookieName(this.config), sid, cookieOptions(this.config, ttlSeconds));
      return res.redirect(302, `${web}${returnTo}`);
    } catch {
      return res.redirect(302, `${web}/?error=login_failed`);
    }
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: AuthedRequest, @Res({ passthrough: true }) res: Response): Promise<void> {
    if (req.sid) await this.auth.logout(req.sid);
    res.clearCookie(sessionCookieName(this.config), { ...cookieOptions(this.config, 0), maxAge: undefined });
  }

  @Get('me')
  me(@CurrentSession() session: SessionData) {
    return {
      id: session.userId,
      username: session.username,
      globalName: session.globalName,
      avatarUrl: userAvatarUrl(session.userId, session.avatarHash, 128),
    };
  }
}
