import Link from 'next/link';
import { SiteFooter } from '@/components/site-footer';
import { PublicSiteHeader } from '@/components/public-site-header';
import { PublicBreadcrumbs } from '@/components/seo/public-page';
import { PUBLIC_PAGE_SEO, createPageMetadata } from '@/lib/seo';

export const metadata = createPageMetadata({ path: '/commands', ...PUBLIC_PAGE_SEO.commands });

const COMMANDS = [
  {
    name: '/kick',
    action: 'Removes a member from the server. They can join again with a valid invite.',
    permission: 'Members with Kick Members; DexBotX also needs Kick Members.',
    example: '/kick member:@member reason:Repeated spam',
  },
  {
    name: '/ban',
    action: 'Bans a user from the server. You can choose whether to delete none, one day, or seven days of their messages.',
    permission: 'Members with Ban Members; DexBotX also needs Ban Members.',
    example: '/ban user:@member delete_messages:1 day reason:Repeated abuse',
  },
  {
    name: '/unban',
    action: 'Removes a ban using the user’s Discord ID.',
    permission: 'Members with Ban Members; DexBotX also needs Ban Members.',
    example: '/unban user_id:<Discord user ID> reason:Appeal accepted',
  },
  {
    name: '/timeout',
    action: 'Prevents a member from interacting for a selected duration: 60 seconds, 5 or 10 minutes, 1 hour, 1 day, or 1 week.',
    permission: 'Members with Moderate Members; DexBotX also needs Moderate Members.',
    example: '/timeout member:@member duration:10 minutes reason:Repeated disruption',
  },
  {
    name: '/untimeout',
    action: 'Removes an active timeout from a member.',
    permission: 'Members with Moderate Members; DexBotX also needs Moderate Members.',
    example: '/untimeout member:@member',
  },
] as const;

export default function CommandsPage() {
  return (
    <>
      <PublicSiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <PublicBreadcrumbs items={[{ name: 'Home', path: '/' }, { name: 'Commands', path: '/commands' }]} />
        <article className="mt-8 space-y-8">
          <header>
            <h1 className="text-balance text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
              DexBotX moderation slash commands
            </h1>
            <p className="mt-5 max-w-3xl leading-7 text-muted-foreground">
              DexBotX provides five moderation commands. The permission shown in Discord controls who can invoke each command; the bot must also have the matching permission. Actions against server members are checked against Discord role hierarchy.
            </p>
          </header>

          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[60rem] border-collapse text-left text-sm">
              <caption className="sr-only">DexBotX moderation commands, required permissions, and examples</caption>
              <thead className="bg-card">
                <tr>
                  <th scope="col" className="p-4 font-semibold">Command</th>
                  <th scope="col" className="p-4 font-semibold">What it does</th>
                  <th scope="col" className="p-4 font-semibold">Who can use it</th>
                  <th scope="col" className="p-4 font-semibold">Example</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-muted-foreground">
                {COMMANDS.map(({ name, action, permission, example }) => (
                  <tr key={name}>
                    <th scope="row" className="whitespace-nowrap p-4 font-mono font-semibold text-foreground">{name}</th>
                    <td className="p-4">{action}</td>
                    <td className="p-4">{permission}</td>
                    <td className="p-4"><code className="whitespace-nowrap text-xs">{example}</code></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <section aria-labelledby="using-commands">
            <h2 id="using-commands" className="text-2xl font-semibold">Using slash-command examples</h2>
            <p className="mt-3 leading-7 text-muted-foreground">
              Type the command in a server text channel and select the matching option in Discord’s slash-command menu. Replace <code>@member</code> with the member picker and <code>&lt;Discord user ID&gt;</code> with the target user’s numeric ID. The <code>/ban</code> command requires a message-deletion choice, and <code>/timeout</code> requires a duration. Optional reasons can be up to 400 characters.
            </p>
            <p className="mt-3 leading-7 text-muted-foreground">
              For actions against server members, the target’s highest role must be below both the moderator’s and DexBotX’s highest roles. DexBotX cannot moderate the server owner. See <Link className="text-primary underline underline-offset-4" href="/features">all DexBotX features and security details</Link> or the <Link className="text-primary underline underline-offset-4" href="/faq">FAQ</Link>.
            </p>
          </section>

          <section aria-labelledby="dashboard-setup">
            <h2 id="dashboard-setup" className="text-2xl font-semibold">Configure the bot</h2>
            <p className="mt-3 leading-7 text-muted-foreground">
              Welcome and goodbye messages are configured from the <Link className="text-primary underline underline-offset-4" href="/dashboard">DexBotX dashboard</Link>, not with slash commands. Sign in with Discord, choose a server you can manage, then select the message settings you want to update. Read the <Link className="text-primary underline underline-offset-4" href="/features/welcome-bot">welcome and goodbye guide</Link> for more detail.
            </p>
          </section>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
