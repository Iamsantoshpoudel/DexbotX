import { NextResponse, type NextRequest } from 'next/server';

/**
 * Keep anonymous visitors out of authenticated pages without starting OAuth automatically.
 * The API validates the session on every request; this cookie check is only an early navigation gate.
 */
const SESSION_COOKIES = ['__Host-dexbotx_sid', 'dexbotx_sid'];

export function proxy(req: NextRequest) {
  if (SESSION_COOKIES.some((name) => req.cookies.has(name))) return NextResponse.next();
  return NextResponse.redirect(new URL('/', req.url));
}

export const config = { matcher: ['/dashboard/:path*', '/admin/:path*'] };
