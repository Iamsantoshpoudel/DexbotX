'use client';

import { notFound, useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { EditorSkeleton } from '@/components/dashboard/loading-skeleton';
import { MESSAGE_KINDS, type MessageKind } from '@/lib/types';

const MessageEditor = dynamic(
  () => import('@/components/message-editor').then((module) => module.MessageEditor),
  { loading: () => <EditorSkeleton title="Loading message" description="Loading your message settings." /> },
);

export default function KindPage() {
  const { guildId, kind } = useParams<{ guildId: string; kind: string }>();
  if (!(MESSAGE_KINDS as readonly string[]).includes(kind)) notFound();
  return <MessageEditor guildId={guildId} kind={kind as MessageKind} />;
}
