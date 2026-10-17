import { Module } from '@nestjs/common';
import { AssetFetcher } from './asset-fetcher.service';
import { MessageBuilder } from './message-builder.service';
import { RenderService } from './render.service';

@Module({
  providers: [RenderService, AssetFetcher, MessageBuilder],
  exports: [RenderService, AssetFetcher, MessageBuilder],
})
export class RenderModule {}
