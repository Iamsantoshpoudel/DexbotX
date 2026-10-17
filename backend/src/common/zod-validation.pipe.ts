import { BadRequestException, NotFoundException, PipeTransform } from '@nestjs/common';
import type { ZodType } from 'zod';
import { MESSAGE_KINDS, MessageKind } from '../shared/message-config';

export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        message: 'Validation failed',
        issues: result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    }
    return result.data;
  }
}

export class ParseKindPipe implements PipeTransform<string, MessageKind> {
  transform(value: string): MessageKind {
    if ((MESSAGE_KINDS as readonly string[]).includes(value)) return value as MessageKind;
    throw new NotFoundException('Unknown message type');
  }
}
