import { NextResponse, type NextRequest } from 'next/server';

/**
 * Cheap gate for /dashboard: no session cookie means no point rendering the page, so start the Discord login
 * right away and return here afterwards. This only checks that a cookie EXISTS. The API validates the session
 * on every request (and answers 401, which sends the user back through login), so this is never the security boundary.
 */
const SESSION_COOKIES = ['__Host-dexbotx_sid', 'dexbotx_sid'];

export function proxy(req: NextRequest) {
  if (SESSION_COOKIES.some((name) => req.cookies.has(name))) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = '/api/auth/login';
  url.search = `?returnTo=${encodeURIComponent(req.nextUrl.pathname)}`;
  return NextResponse.redirect(url);
}

export const config = { matcher: ['/dashboard/:path*'] };
