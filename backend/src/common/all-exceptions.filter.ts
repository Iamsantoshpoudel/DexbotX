import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import * as Sentry from '@sentry/node';
import type { Response } from 'express';
import { DiscordApiError } from '../discord/discord-rest.service';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let body: Record<string, unknown> = { statusCode: status, message: 'Something went wrong on our side. Try again in a moment.' };

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const r = exception.getResponse();
      body = typeof r === 'string' ? { statusCode: status, message: r } : { statusCode: status, ...(r as object) };
      if (typeof body.retryAfter === 'number') res.setHeader('Retry-After', String(Math.ceil(body.retryAfter)));
    } else if (exception instanceof DiscordApiError) {
      if (exception.status === 429) {
        status = HttpStatus.TOO_MANY_REQUESTS;
        body = { statusCode: status, message: 'Discord is rate limiting requests. Try again shortly.' };
        if (exception.retryAfter) res.setHeader('Retry-After', String(Math.ceil(exception.retryAfter)));
      } else if (exception.status === 401) {
        status = HttpStatus.UNAUTHORIZED;
        body = { statusCode: status, message: 'Your Discord session expired. Log in again.' };
      } else {
        status = HttpStatus.BAD_GATEWAY;
        body = { statusCode: status, message: 'Discord did not respond as expected. Try again in a moment.' };
        this.logger.warn(`Discord API error ${exception.status}/${exception.discordCode}: ${exception.message}`);
      }
    }

    if (status >= 500) {
      Sentry.captureException(exception);
      if (!(exception instanceof DiscordApiError)) {
        this.logger.error(exception instanceof Error ? (exception.stack ?? exception.message) : String(exception));
      }
    }

    if (!res.headersSent) res.status(status).json(body);
  }
}
