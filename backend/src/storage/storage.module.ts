import { Module } from '@nestjs/common';
import { AssetStorage } from './asset-storage.service';

@Module({ providers: [AssetStorage], exports: [AssetStorage] })
export class StorageModule {}
