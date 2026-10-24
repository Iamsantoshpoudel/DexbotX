import { Module } from '@nestjs/common';
import { PresetsController, TemplatesController } from './templates.controller';

@Module({ controllers: [TemplatesController, PresetsController] })
export class TemplatesModule {}
