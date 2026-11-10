import { NextResponse, type NextRequest } from 'next/server';
import { isSocialPreviewUserAgent } from '@/lib/social-preview-user-agent';

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname !== '/og-banner') {
    return NextResponse.next();
  }

  const imagePath = isSocialPreviewUserAgent(request.headers.get('user-agent'))
    ? '/assets/dexbotx-og-banner.jpg'
    : '/dexbotx-banner.gif';
  const response = NextResponse.rewrite(new URL(imagePath, request.url));
  response.headers.set('Vary', 'User-Agent');
  return response;
}

export const config = {
  matcher: '/og-banner',
};
