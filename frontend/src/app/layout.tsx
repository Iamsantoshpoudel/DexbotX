import type { Metadata, Viewport } from 'next';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { GeistMono } from 'geist/font/mono';
import { GeistSans } from 'geist/font/sans';
import type { ReactNode } from 'react';
import { Providers } from '@/components/providers';
import { HOME_SEO } from '@/lib/seo';
import { SITE } from '@/lib/site';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: HOME_SEO.title, template: '%s' },
  description: HOME_SEO.description,
  keywords: HOME_SEO.keywords,
  applicationName: SITE.brandName,
  authors: [{ name: SITE.creator, url: SITE.githubUrl }],
  creator: SITE.creator,
  publisher: SITE.creator,
  category: 'technology',
  formatDetection: {
    telephone: false,
    date: false,
    address: false,
    email: false,
    url: false,
  },
  openGraph: {
    type: 'website',
    url: '/',
    siteName: SITE.brandName,
    title: HOME_SEO.title,
    description: HOME_SEO.description,
    locale: 'en_US',
    images: [{
      url: '/opengraph-image',
      width: 1200,
      height: 630,
      alt: 'DexBotX, free open source Discord bot',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: HOME_SEO.title,
    description: HOME_SEO.description,
    images: ['/opengraph-image'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  icons: { icon: '/icon.png', apple: '/apple-icon' },
  manifest: '/manifest.webmanifest',
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION ?? 'eHHX8HxZQ1RJEtBuFqKb6MlX9dfrLGgKeixurMjHiBQ',
  },
};

export const viewport: Viewport = {
  themeColor: '#8ab4f8',
  colorScheme: 'dark light',
};

const isVercelDeployment = process.env.VERCEL === '1';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body suppressHydrationWarning className="min-h-dvh font-sans antialiased">
        <Providers>{children}</Providers>
        {isVercelDeployment && (
          <>
            <Analytics />
            <SpeedInsights />
          </>
        )}
      </body>
    </html>
  );
}
