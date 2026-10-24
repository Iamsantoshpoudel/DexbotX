import { CanActivate, ExecutionContext, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { APP_CONFIG, AppConfig } from '../core/config';
import type { AuthedRequest } from '../common/types';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthedRequest>();
    if (!request.session || !this.config.adminUserIds.includes(request.session.userId)) {
      throw new NotFoundException(`Cannot ${request.method} ${request.originalUrl}`);
    }
    return true;
  }
}
