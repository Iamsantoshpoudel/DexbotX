import { NextResponse, type NextRequest } from 'next/server';
import { isDiscordUserAgent } from '@/lib/discord-user-agent';

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname !== '/og-banner') {
    return NextResponse.next();
  }

  const imagePath = isDiscordUserAgent(request.headers.get('user-agent'))
    ? '/dexbotx-banner.gif'
    : '/assets/dexbotx-og-banner.jpg';
  const response = NextResponse.rewrite(new URL(imagePath, request.url));
  response.headers.set('Vary', 'User-Agent');
  return response;
}

export const config = {
  matcher: '/og-banner',
};
