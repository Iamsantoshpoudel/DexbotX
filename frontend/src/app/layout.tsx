import type { Metadata, Viewport } from 'next';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { GeistMono } from 'geist/font/mono';
import { GeistSans } from 'geist/font/sans';
import type { ReactNode } from 'react';
import { Providers } from '@/components/providers';
import { SITE } from '@/lib/site';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(SITE.siteUrl),
  title: { default: SITE.title, template: '%s' },
  description: SITE.description,
  keywords: SITE.keywords,
  applicationName: SITE.brandName,
  authors: [{ name: SITE.creator, url: SITE.githubUrl }],
  creator: SITE.creator,
  publisher: SITE.creator,
  alternates: { canonical: '/' },
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
    title: SITE.title,
    description: SITE.description,
    locale: 'en_US',
    images: [{ ...SITE.socialImage, alt: 'DexBotX, free open source Discord bot' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE.title,
    description: SITE.description,
    images: [SITE.socialImage.url],
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
  icons: { icon: '/icon.png', apple: '/apple-icon.png' },
  manifest: '/manifest.webmanifest',
  verification: {
    ...(process.env.GOOGLE_SITE_VERIFICATION
      ? { google: process.env.GOOGLE_SITE_VERIFICATION }
      : {}),
    ...(process.env.BING_SITE_VERIFICATION
      ? { other: { 'msvalidate.01': process.env.BING_SITE_VERIFICATION } }
      : {}),
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
