import { redirect } from 'next/navigation';

export default async function GuildIndex({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  redirect(`/dashboard/${encodeURIComponent(guildId)}/welcome`);
}
