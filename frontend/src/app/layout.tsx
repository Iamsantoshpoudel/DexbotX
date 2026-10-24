import type { Metadata } from 'next';
import { GeistMono } from 'geist/font/mono';
import { GeistSans } from 'geist/font/sans';
import type { ReactNode } from 'react';
import { Providers } from '@/components/providers';
import { SITE } from '@/lib/site';
import './globals.css';
export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: SITE.title, template: `%s · ${SITE.brandName}` },
  description: SITE.description,
  keywords: SITE.keywords,
  applicationName: SITE.brandName,
  authors: [{ name: SITE.creatorDisplayName, url: SITE.githubUrl }],
  creator: SITE.creatorDisplayName,
  publisher: SITE.brandName,
  alternates: { canonical: '/' },
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
    images: [
      {
        url: SITE.bannerGif,
        width: 680,
        height: 240,
        alt: `${SITE.brandName} welcome card banner`,
        type: 'image/gif',
      },
      {
        url: '/og.png',
        width: 1200,
        height: 630,
        alt: `${SITE.brandName} welcome card banner`,
        type: 'image/png',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE.title,
    description: SITE.description,
    images: ['/og.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { 'max-image-preview': 'large', 'max-snippet': -1 },
  },
  icons: { icon: '/icon.png', apple: '/apple-icon' },
  manifest: '/manifest.webmanifest',
  other: { 'theme-color': '#8ab4f8', 'color-scheme': 'dark light' },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-dvh font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
