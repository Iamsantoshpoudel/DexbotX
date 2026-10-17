import { Controller, Get, NotFoundException, Req, Res, UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Public, RateLimit } from '../common/decorators';
import { MetricsService } from './metrics.service';

@Controller('metrics')
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  /** Scraped by Prometheus directly on the API (not through the dashboard proxy). */
  @Public()
  @Get()
  @RateLimit('metrics', 120)
  async scrape(@Req() req: Request, @Res() res: Response): Promise<void> {
    if (!this.metrics.enabled) throw new NotFoundException();
    if (!this.metrics.isAuthorized(req.get('authorization'))) throw new UnauthorizedException();
    res.setHeader('Cache-Control', 'no-store');
    res.type(this.metrics.contentType).send(await this.metrics.render());
  }
}
