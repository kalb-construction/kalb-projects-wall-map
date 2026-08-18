export const config = { runtime: 'edge' };

import { COOKIE, PASS, ONE_YEAR, sameValue } from './_shared';

/**
 * Access gate for the wall map.
 *
 * The deployment is on the public internet and every pin carries a job
 * number, a street address, a project manager's name and a square footage.
 * This keeps it to people holding the link.
 *
 * The entry link:
 *
 *   /api/gate?k=<SITE_KEY>   → sets the cookie, redirects to the map
 *   anything else            → 404
 *
 * 404 rather than 401 on purpose: a 401 puts a credentials dialog on a lobby
 * display, and it confirms to anyone probing that there is something here.
 *
 * This function is only half the gate -- see api/serve.ts for the other
 * half, which is what actually withholds the app and the sensitive data
 * from anyone who never came through here.
 */

const notFound = () =>
  new Response('Not Found', {
    status: 404,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow'
    }
  });

export default function handler(request: Request): Response {
  const key = process.env.SITE_KEY;
  const supplied = new URL(request.url).searchParams.get('k');

  if (!key || supplied === null || !sameValue(supplied, key)) return notFound();

  return new Response(null, {
    status: 302,
    headers: {
      // The key never reaches the address bar, so it cannot end up in
      // history, a screenshot of the kiosk, or a Referer header.
      Location: '/',
      'Set-Cookie':
        `${COOKIE}=${PASS}; Path=/; Max-Age=${ONE_YEAR}; ` +
        'HttpOnly; Secure; SameSite=Lax',
      'Cache-Control': 'no-store'
    }
  });
}
