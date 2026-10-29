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
  const personId = `${SITE.url}/#person`;
  const organizationId = `${SITE.url}/#organization`;
  const features = [
    'Welcome and goodbye messages with personalized member cards',
    'Moderation tools',
    'Anti-spam automation',
    'Automatic role management',
    'Social notifications including YouTube and Kick',
    'AI auto chat',
    'Web dashboard configuration',
    'Free and open source',
    'Fast, reliable server automation',
  ];

  return (
    <JsonLd
      data={{
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'Person',
            '@id': personId,
            name: 'dexgamex',
            alternateName: SITE.creatorDisplayName,
            url: SITE.url,
            sameAs: [SITE.githubUrl, SITE.discordServerUrl],
          },
          {
            '@type': 'Organization',
            '@id': organizationId,
            name: SITE.brandName,
            url: SITE.url,
            founder: { '@id': personId },
            sameAs: [SITE.githubUrl, SITE.discordServerUrl],
            logo: { '@type': 'ImageObject', url: `${SITE.url}/icon.png` },
          },
          {
            '@type': 'WebSite',
            '@id': `${SITE.url}/#website`,
            name: SITE.brandName,
            url: SITE.url,
            description: SITE.description,
            publisher: { '@id': organizationId },
            inLanguage: 'en',
          },
          {
            '@type': 'SoftwareApplication',
            '@id': `${SITE.url}/#software`,
            name: SITE.brandName,
            applicationCategory: 'CommunicationApplication',
            operatingSystem: 'Web, Discord',
            url: SITE.url,
            description: SITE.description,
            image: `${SITE.url}/opengraph-image`,
            offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
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
          item: new URL(path, SITE.url).toString(),
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
