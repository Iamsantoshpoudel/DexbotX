import { SITE } from '@/lib/site';

type JsonLdData = Record<string, unknown>;

function JsonLd({ data }: { data: JsonLdData }) {
  const json = JSON.stringify(data).replace(/[<>&\u2028\u2029]/g, (character) => {
    const escaped: Record<string, string> = {
      '<': '\\u003c',
      '>': '\\u003e',
      '&': '\\u0026',
      '\u2028': '\\u2028',
      '\u2029': '\\u2029',
    };
    return escaped[character]!;
  });

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}

export function SiteStructuredData() {
  const personId = `${SITE.siteUrl}/#person`;
  const organizationId = `${SITE.siteUrl}/#organization`;
  const features = [
    'Fast and reliable Discord automation',
    'Free and open source',
    'Easy web dashboard configuration',
    'AI auto chat',
    'Social notifications',
    'Anti-spam',
    'Automatic role management',
    'Welcome and goodbye messages',
    'Moderation commands',
  ];

  return (
    <JsonLd
      data={{
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'Person',
            '@id': personId,
            name: SITE.creator,
            url: SITE.githubUrl,
            sameAs: SITE.profileUrls,
          },
          {
            '@type': 'Organization',
            '@id': organizationId,
            name: SITE.creator,
            url: SITE.siteUrl,
            founder: { '@id': personId },
            sameAs: SITE.profileUrls,
            logo: { '@type': 'ImageObject', url: `${SITE.siteUrl}/icon.png` },
          },
          {
            '@type': 'WebSite',
            '@id': `${SITE.siteUrl}/#website`,
            name: SITE.brandName,
            alternateName: ['Dex Bot X', 'DexGameX bot'],
            url: SITE.siteUrl,
            description: SITE.description,
            publisher: { '@id': organizationId },
            inLanguage: 'en',
          },
          {
            '@type': 'SoftwareApplication',
            '@id': `${SITE.siteUrl}/#software`,
            name: SITE.brandName,
            applicationCategory: 'UtilitiesApplication',
            operatingSystem: 'Discord',
            url: SITE.siteUrl,
            description: SITE.description,
            image: `${SITE.siteUrl}${SITE.socialImage.url}`,
            offers: { '@type': 'Offer', price: 0, priceCurrency: 'USD' },
            author: { '@id': personId },
            publisher: { '@id': organizationId },
            featureList: features,
          },
        ],
      }}
    />
  );
}

export function BreadcrumbStructuredData({ items }: { items: readonly { name: string; path: string }[] }) {
  return (
    <JsonLd
      data={{
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: items.map(({ name, path }, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name,
          item: new URL(path, SITE.siteUrl).toString(),
        })),
      }}
    />
  );
}

export function FaqStructuredData({ items }: { items: readonly { question: string; answer: string }[] }) {
  return (
    <JsonLd
      data={{
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: items.map(({ question, answer }) => ({
          '@type': 'Question',
          name: question,
          acceptedAnswer: { '@type': 'Answer', text: answer },
        })),
      }}
    />
  );
}
