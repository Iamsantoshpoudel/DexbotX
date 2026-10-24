import { Body, Controller, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import type { AuthedRequest } from '../common/types';
import { Public, RateLimit } from '../common/decorators';
import { AdminAuditService } from './admin-audit.service';
import { AdminOperationsService } from './admin-operations.service';
import { AdminOverviewService } from './admin-overview.service';
import { AdminGuard } from './admin.guard';
import { AdminUsersContentService } from './admin-users-content.service';
import { FeatureFlagsService } from '../core/feature-flags.service';

@Public()
@Controller('admin')
@UseGuards(AdminGuard)
@RateLimit('admin', 120)
export class AdminController {
  constructor(
    private readonly overview: AdminOverviewService,
    private readonly operations: AdminOperationsService,
    private readonly audit: AdminAuditService,
    private readonly usersContent: AdminUsersContentService,
    private readonly flags: FeatureFlagsService,
  ) {}

  @Get('me')
  me(): { admin: true } {
    return { admin: true };
  }

  @Get('overview')
  overviewData() {
    return this.overview.overview();
  }

  @Get('rate-limits')
  rateLimits() {
    return this.overview.rateLimits();
  }

  @Get('guilds')
  guilds(@Query('search') search = '', @Query('page') page = '1') {
    return this.operations.listGuilds(search, Number(page));
  }

  @Get('guilds/:id')
  guild(@Param('id') id: string) {
    return this.operations.guildDetail(id);
  }

  @Post('guilds/:id/resync')
  resyncGuild(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.operations.resyncGuild(req.session!.userId, id);
  }

  @Post('guilds/:id/disable')
  disableGuild(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.operations.disableGuild(req.session!.userId, id);
  }

  @Post('guilds/:id/leave')
  leaveGuild(@Param('id') id: string, @Body() body: { confirm?: string }, @Req() req: AuthedRequest) {
    return this.operations.leaveGuild(req.session!.userId, id, body?.confirm ?? '');
  }

  @Get('failures')
  failures() {
    return this.operations.failures();
  }

  @Post('failures/clear')
  clearFailures(@Body() body: { confirm?: boolean }, @Req() req: AuthedRequest) {
    return this.operations.clearFailures(req.session!.userId, body?.confirm === true);
  }

  @Post('failures/:jobId/retry')
  retryFailure(@Param('jobId') jobId: string, @Req() req: AuthedRequest) {
    return this.operations.retryFailure(req.session!.userId, jobId);
  }

  @Get('audit')
  auditEvents(@Query('page') page = '1', @Query('action') action = '') {
    return this.audit.page(Number(page), action);
  }

  @Get('users')
  users() {
    return this.usersContent.users();
  }

  @Post('users/:id/revoke')
  revokeUser(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.usersContent.revokeUser(req.session!.userId, id);
  }

  @Get('content')
  content() {
    return this.usersContent.content();
  }

  @Post('content/background')
  deleteBackground(@Body() body: { path?: string; confirm?: boolean }, @Req() req: AuthedRequest) {
    return this.usersContent.deleteBackground(req.session!.userId, body?.path ?? '', body?.confirm === true);
  }

  @Get('flags')
  featureFlags() {
    return this.flags.get();
  }

  @Put('flags')
  updateFeatureFlags(@Body() body: unknown, @Req() req: AuthedRequest) {
    return this.usersContent.updateFlags(req.session!.userId, body);
  }
}

@Public()
@Controller('flags')
export class PublicFlagsController {
  constructor(private readonly flags: FeatureFlagsService) {}

  @Get()
  getFlags() {
    return this.flags.getPublic();
  }
}
