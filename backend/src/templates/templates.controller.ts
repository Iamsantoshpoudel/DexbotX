import { Controller, Get, Header } from '@nestjs/common';
import { Public } from '../common/decorators';
import { PRESETS } from '../shared/presets';

@Controller('templates')
export class TemplatesController {
  /** Ready-made templates. Identical for everyone, so browsers and the CDN may cache it. */
  @Public()
  @Get('presets')
  @Header('Cache-Control', 'public, max-age=3600')
  presets() {
    return { presets: PRESETS };
  }
}
