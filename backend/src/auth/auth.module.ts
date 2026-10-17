import { Module } from '@nestjs/common';
import { DiscordModule } from '../discord/discord.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SessionService } from './session.service';

@Module({
  imports: [DiscordModule],
  controllers: [AuthController],
  providers: [AuthService, SessionService],
  exports: [SessionService],
})
export class AuthModule {}
