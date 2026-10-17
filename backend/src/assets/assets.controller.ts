import {
  BadRequestException,
  Controller,
  HttpCode,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentSession, RateLimit } from '../common/decorators';
import type { AuthedRequest, SessionData } from '../common/types';
import { DatabaseService } from '../db/database.service';
import { auditLogs } from '../db/schema';
import { GuildAccessGuard } from '../guilds/guild-access.guard';
import { AssetStorage } from '../storage/asset-storage.service';
import { processBackground } from './background-image';

@Controller('guilds/:guildId/assets')
@UseGuards(GuildAccessGuard) // guards run before the upload is parsed, so strangers cannot make us buffer files
export class AssetsController {
  constructor(
    private readonly storage: AssetStorage,
    private readonly database: DatabaseService,
  ) {}

  /** multipart/form-data, field "file". Returns the reference to put in `image.backgroundPath`. */
  @Post('background')
  @HttpCode(201)
  @RateLimit('assets-upload', 10)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024, files: 1, fields: 0 } }))
  async uploadBackground(
    @UploadedFile() file: { buffer: Buffer } | undefined,
    @CurrentSession() session: SessionData,
    @Req() req: AuthedRequest,
  ) {
    if (!this.storage.enabled) throw new BadRequestException('Custom backgrounds are not enabled on this server');
    if (!file) throw new BadRequestException('Attach an image in the "file" field');
    const guildId = req.guild!.id;
    const { data, hash } = await processBackground(file.buffer);
    const path = `${guildId}/${hash}.jpg`;
    await this.storage.put(path, data);
    await this.database.db.insert(auditLogs).values({ guildId, userId: session.userId, action: 'background.upload' });
    return { path };
  }
}
