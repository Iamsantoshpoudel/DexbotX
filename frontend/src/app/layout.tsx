import type { Metadata, Viewport } from 'next';
import { GeistMono } from 'geist/font/mono';
import { GeistSans } from 'geist/font/sans';
import type { ReactNode } from 'react';
import { Providers } from '@/components/providers';
import './globals.css';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? (
  process.env.NODE_ENV === 'production' ? 'https://dexbotx.vercel.app' : 'http://localhost:3000'
);
const DESCRIPTION = 'A public Discord bot that greets new members with custom image cards. Configure welcome and goodbye messages from a clean dashboard.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: 'DexbotX · Welcome cards for Discord', template: '%s · DexbotX' },
  description: DESCRIPTION,
  alternates: { canonical: '/' },
  robots: { index: true, follow: true },
  openGraph: { type: 'website', siteName: 'DexbotX', title: 'DexbotX · Welcome cards for Discord', description: DESCRIPTION, url: '/' },
  twitter: { card: 'summary', title: 'DexbotX · Welcome cards for Discord', description: DESCRIPTION },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#090912' },
    { media: '(prefers-color-scheme: light)', color: '#f6f6fb' },
  ],
  colorScheme: 'dark light',
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
