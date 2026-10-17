import type { CookieOptions } from 'express';
import type { AppConfig } from '../core/config';

/** "__Host-" cookies must be Secure, Path=/ and have no Domain: the browser then refuses to let subdomains overwrite them. */
export function sessionCookieName(config: AppConfig): string {
  return config.cookieSecure && !config.cookieDomain ? '__Host-dexbotx_sid' : 'dexbotx_sid';
}

export function stateCookieName(config: AppConfig): string {
  return config.cookieSecure && !config.cookieDomain ? '__Host-dexbotx_oauth' : 'dexbotx_oauth';
}

export function cookieOptions(config: AppConfig, maxAgeSeconds: number): CookieOptions {
  return {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: 'lax',
    path: '/',
    domain: config.cookieDomain,
    maxAge: maxAgeSeconds * 1000,
  };
}
