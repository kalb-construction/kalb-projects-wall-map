import { next } from '@vercel/edge';

/**
 * Access gate for the wall map.
 *
 * The deployment is on the public internet, and every pin carries a job
 * number, a street address, a project manager's name and a square footage.
 * This keeps it to people holding the link.
 *
 * How it behaves:
 *   /?k=<SITE_KEY>  → sets a one-year cookie, then redirects to a clean URL
 *   any request with that cookie → passes through
 *   anything else → 404
 *
 * 404 rather than 401 on purpose. A 401 makes the browser throw up a
 * credentials dialog, which is the wrong thing to happen on a lobby display,
 * and it confirms to anyone probing that there is something here.
 *
 * The kiosk opens the ?k= link once and is never asked again. Sharing the
 * site means sharing that link.
 */

const COOKIE = 'ka_pass';
const ONE_YEAR = 60 * 60 * 24 * 365;

/** Length-independent compare, so a wrong key leaks nothing through timing. */
function sameKey(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) {
      return decodeURIComponent(part.slice(eq + 1).trim());
    }
  }
  return null;
}

export default function middleware(request: Request): Response {
  const key = process.env.SITE_KEY;

  // No key configured means no gate. This is deliberate: the middleware
  // deploys the moment it is pushed, before anyone can add the variable in
  // Vercel, and failing closed would take the lobby display down in that
  // gap. Setting SITE_KEY is what arms it — until then the site is open,
  // exactly as it was before.
  if (!key) return next();

  const url = new URL(request.url);
  const supplied = url.searchParams.get('k');

  if (supplied !== null && sameKey(supplied, key)) {
    // Drop the secret from the address bar so it cannot end up in browser
    // history, a screenshot of the kiosk, or a Referer header on the way to
    // Mapbox. The fragment is never sent to the server and the browser
    // carries it across the redirect on its own.
    url.searchParams.delete('k');
    const clean = url.pathname + (url.search === '?' ? '' : url.search);
    return new Response(null, {
      status: 302,
      headers: {
        Location: clean || '/',
        'Set-Cookie':
          `${COOKIE}=${encodeURIComponent(key)}; Path=/; Max-Age=${ONE_YEAR}; ` +
          'HttpOnly; Secure; SameSite=Lax',
        'Cache-Control': 'no-store'
      }
    });
  }

  const held = readCookie(request.headers.get('cookie'), COOKIE);
  if (held !== null && sameKey(held, key)) return next();

  return new Response('Not Found', {
    status: 404,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow'
    }
  });
}
