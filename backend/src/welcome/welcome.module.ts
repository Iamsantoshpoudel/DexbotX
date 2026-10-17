import { Module } from '@nestjs/common';
import { DiscordModule } from '../discord/discord.module';
import { GuildsModule } from '../guilds/guilds.module';
import { RenderModule } from '../render/render.module';
import { StorageModule } from '../storage/storage.module';
import { WelcomeController } from './welcome.controller';
import { WelcomeService } from './welcome.service';

@Module({
  imports: [GuildsModule, DiscordModule, RenderModule, StorageModule],
  controllers: [WelcomeController],
  providers: [WelcomeService],
})
export class WelcomeModule {}
