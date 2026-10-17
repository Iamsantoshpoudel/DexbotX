import { Module } from '@nestjs/common';
import { GuildsModule } from '../guilds/guilds.module';
import { StorageModule } from '../storage/storage.module';
import { AssetsController } from './assets.controller';

@Module({ imports: [GuildsModule, StorageModule], controllers: [AssetsController] })
export class AssetsModule {}
