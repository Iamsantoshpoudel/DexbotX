'use client';

import { notFound, useParams } from 'next/navigation';
import { MessageEditor } from '@/components/message-editor';
import { MESSAGE_KINDS, type MessageKind } from '@/lib/types';

export default function KindPage() {
  const { guildId, kind } = useParams<{ guildId: string; kind: string }>();
  if (!(MESSAGE_KINDS as readonly string[]).includes(kind)) notFound();
  return <MessageEditor guildId={guildId} kind={kind as MessageKind} />;
}
