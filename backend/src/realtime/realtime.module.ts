import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { GuildsModule } from '../guilds/guilds.module';
import { RealtimeController } from './realtime.controller';
import { RealtimeGateway } from './realtime.gateway';

@Module({
  imports: [AuthModule, GuildsModule],
  controllers: [RealtimeController],
  providers: [RealtimeGateway],
})
export class RealtimeModule {}
