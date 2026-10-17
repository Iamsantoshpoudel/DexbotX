import { Module } from '@nestjs/common';
import { MemberEventsQueue } from './member-events.queue';

@Module({ providers: [MemberEventsQueue], exports: [MemberEventsQueue] })
export class QueueModule {}
