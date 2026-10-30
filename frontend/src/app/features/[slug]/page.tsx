import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SiteFooter } from '@/components/site-footer';
import { PublicSiteHeader } from '@/components/public-site-header';
import { BreadcrumbStructuredData } from '@/components/seo/json-ld';
import { SITE } from '@/lib/site';
import { createPageMetadata, FEATURE_PAGES } from '@/lib/seo';

export const dynamicParams = false;

export function generateStaticParams() {
  return FEATURE_PAGES.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const feature = FEATURE_PAGES.find((item) => item.slug === slug);
  if (!feature) return {};
  return createPageMetadata({
    path: `/features/${feature.slug}`,
    title: feature.title,
    description: feature.description,
    keywords: feature.keywords,
  });
}

function renderLinkedText(text: string) {
  const parts = text.split(/(\[[^\]]+\]\([^)]+\))/g);
  return parts.map((part, index) => {
    const match = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
    if (!match) return part;
    return <Link key={`${match[2]}-${index}`} className="text-primary underline underline-offset-4" href={match[2]}>{match[1]}</Link>;
  });
}

export default async function FeaturePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const feature = FEATURE_PAGES.find((item) => item.slug === slug);
  if (!feature) notFound();

  const breadcrumbs = [
    { name: 'Home', path: '/' },
    { name: 'Features', path: '/#features' },
    { name: feature.name, path: `/features/${feature.slug}` },
  ];

  return (
    <>
      <BreadcrumbStructuredData items={breadcrumbs} />
      <PublicSiteHeader />
      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
          <ol className="flex flex-wrap gap-2">
            <li><Link className="underline-offset-4 hover:underline" href="/">Home</Link></li>
            <li aria-hidden="true">/</li>
            <li><Link className="underline-offset-4 hover:underline" href="/#features">Features</Link></li>
            <li aria-hidden="true">/</li>
            <li aria-current="page">{feature.name}</li>
          </ol>
        </nav>
        <article className="mt-8">
          <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
            DexBotX {feature.name} for Discord
          </h1>
          <div className="mt-6 space-y-4 text-base leading-7 text-muted-foreground">
            {feature.intro.map((paragraph) => <p key={paragraph}>{renderLinkedText(paragraph)}</p>)}
          </div>
          <div className="mt-10 space-y-8">
            {feature.sections.map(({ heading, paragraphs }) => (
              <section key={heading}>
                <h2 className="text-2xl font-semibold tracking-tight text-foreground">{heading}</h2>
                <div className="mt-3 space-y-4 leading-7 text-muted-foreground">
                  {paragraphs.map((paragraph) => <p key={paragraph}>{renderLinkedText(paragraph)}</p>)}
                </div>
              </section>
            ))}
          </div>
          <section className="mt-10 border-t border-border pt-8" aria-labelledby="related-features">
            <h2 id="related-features" className="text-xl font-semibold">Explore more DexBotX features</h2>
            <ul className="mt-4 flex flex-wrap gap-3">
              {feature.related.map((relatedSlug) => {
                const related = FEATURE_PAGES.find((item) => item.slug === relatedSlug);
                if (!related) return null;
                return (
                  <li key={related.slug}>
                    <Link className="inline-flex min-h-11 items-center rounded-lg border border-border px-4 text-sm text-primary hover:bg-muted" href={`/features/${related.slug}`}>
                      {related.name} for Discord
                    </Link>
                  </li>
                );
              })}
            </ul>
            <p className="mt-6 text-sm leading-6 text-muted-foreground">
              DexBotX is free and open source. <Link className="text-primary underline underline-offset-4" href="/about">Learn about the project</Link>, browse the <Link className="text-primary underline underline-offset-4" href="/faq">DexBotX FAQ</Link>, or <a className="text-primary underline underline-offset-4" href="/api/invite">add DexBotX to your Discord server</a>.
            </p>
          </section>
        </article>
        <p className="mt-8 text-sm text-muted-foreground">
          Developed by {SITE.creator}.
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
