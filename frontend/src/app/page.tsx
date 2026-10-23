import { Gauge, Image as ImageIcon, LockKeyhole, MessageSquareText, Palette, Variable } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';
import { Logo } from '@/components/logo';
import { LoginErrorBanner } from '@/components/login-error-banner';
import { CardMock } from '@/components/preview/card-mock';
import { SiteHeader } from '@/components/site-header';
import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/misc';
import { cn } from '@/lib/utils';

const FEATURES = [
  { icon: ImageIcon, title: 'Personalized member cards', body: "Each member's avatar is drawn onto a custom image. Choose a style, and optionally use your server banner or a custom background." },
  { icon: MessageSquareText, title: 'Welcome and goodbye', body: 'Two independent messages, each with its own channel, text, embed and card.' },
  { icon: Palette, title: 'Presets to start fast', body: 'Pick a ready-made design, tweak the words and colours, and see the real card update as you type.' },
  { icon: Variable, title: 'Variables', body: 'Use {user}, {server}, {memberCount} and more. The text adapts to every member.' },
  { icon: Gauge, title: 'Built for busy servers', body: 'Settings are cached and image rendering is rate limited, so a join wave does not slow your server down.' },
  { icon: LockKeyhole, title: 'Minimal permissions', body: 'DexbotX asks only for View Channel, Send Messages, Embed Links and Attach Files. Never Administrator.' },
];

const FAQ = [
  { q: 'Is DexbotX free?', a: 'Yes. Adding the bot and configuring welcome and goodbye messages costs nothing.' },
  { q: 'What permissions does the bot need?', a: 'View Channel, Send Messages, Embed Links and Attach Files. It never asks for Administrator.' },
  { q: 'Who can change my server\u2019s settings?', a: 'Only people with the Manage Server permission (or the owner). The dashboard checks this on the server for every request.' },
  { q: 'What does DexbotX store?', a: 'Your server\u2019s name, icon and member count, its channels and roles for dashboard selectors, the messages and custom backgrounds you configure, a log of who changed which setting, and an encrypted login session. Member avatars are fetched from Discord when needed and are not stored.' },
  { q: 'Why does the bot need the Server Members intent?', a: 'Discord only tells a bot when someone joins or leaves if this intent is on. It is used for nothing else.' },
];

export const dynamic = 'force-static';

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main>
        <Suspense fallback={null}>
          <LoginErrorBanner />
        </Suspense>

        <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-16 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pt-24">
          <div className="fade-up">
            <p className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground">
              <span className="size-1.5 rounded-full bg-success" /> Free · public · works on any server
            </p>
            <h1 className="mt-5 text-balance text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
              Welcome cards your members actually <span className="text-primary">notice</span>.
            </h1>
            <p className="mt-5 max-w-xl text-pretty text-lg text-muted-foreground">
              DexbotX greets every new member with an image of their own avatar on your server&apos;s style. Set it all up in a clean dashboard. No commands to memorise.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="/api/invite" className={cn(buttonVariants({ size: 'lg' }))}>
                Add to Discord
              </a>
              <Link href="/dashboard" className={cn(buttonVariants({ size: 'lg', variant: 'secondary' }))}>
                Open dashboard
              </Link>
            </div>
          </div>

          <div className="fade-up space-y-4 [animation-delay:120ms]" aria-hidden>
            <CardMock />
            <div className="grid grid-cols-2 gap-4">
              <CardMock style="sunset" title="Goodbye" name="Kai" subtitle="We will miss you" accent="#fb923c" members="1,203 members" />
              <CardMock style="neon" title="Player joined" name="Rin" subtitle="Say hello" accent="#22d3ee" members="1,205 members" />
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight">Everything a greeting needs, nothing it doesn&apos;t</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <Card key={title} className="p-5">
                <div className="grid size-10 place-items-center rounded-xl bg-primary/15 text-primary">
                  <Icon className="size-5" />
                </div>
                <h3 className="mt-4 font-medium">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
              </Card>
            ))}
          </div>
        </section>

        <section aria-labelledby="faq-heading" className="mx-auto max-w-3xl px-4 pb-24 sm:px-6">
          <h2 id="faq-heading" className="text-2xl font-semibold tracking-tight">
            Questions
          </h2>
          <div className="mt-6 divide-y divide-border rounded-2xl border border-border bg-card/80">
            {FAQ.map(({ q, a }) => (
              <details key={q} className="group px-5 py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-md font-medium marker:hidden [&::-webkit-details-marker]:hidden">
                  {q}
                  <span aria-hidden className="text-muted-foreground transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>
      <footer className="border-t border-border/60 py-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 text-sm text-muted-foreground sm:px-6">
          <Logo />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Link href="/terms" className="underline-offset-4 hover:underline">Terms of Service</Link>
            <Link href="/privacy" className="underline-offset-4 hover:underline">Privacy Policy</Link>
            <Link href="/dashboard" className="underline-offset-4 hover:underline">Dashboard</Link>
            <span>Not affiliated with Discord Inc.</span>
          </div>
        </div>
      </footer>
    </>
  );
}
