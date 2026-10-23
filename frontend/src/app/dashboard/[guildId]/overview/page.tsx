import { OverviewContent } from '@/components/dashboard/overview-content';

export default async function OverviewPage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  return <OverviewContent guildId={guildId} />;
}