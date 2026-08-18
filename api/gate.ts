export const config = { runtime: 'edge' };

/**
 * Access gate for the wall map.
 *
 * The deployment is on the public internet and every pin carries a job
 * number, a street address, a project manager's name and a square footage.
 * This keeps it to people holding the link.
 *
 * Two halves, and they have to be read together:
 *
 *   1. vercel.json redirects every request that does not already carry the
 *      access cookie here. Redirects are evaluated before the filesystem, so
 *      this catches index.html, the bundle, the photos and data/projects.json
 *      alike. (A rewrite would not — the filesystem wins over rewrites.)
 *   2. This function is the only way to get that cookie, and it only hands
 *      one out in exchange for the key.
 *
 * So the entry link is this endpoint, not the site root:
 *
 *   /api/gate?k=<SITE_KEY>   → sets the cookie, redirects to the map
 *   anything else            → 404
 *
 * 404 rather than 401 on purpose: a 401 puts a credentials dialog on a lobby
 * display, and it confirms to anyone probing that there is something here.
 */

/** Must match the cookie value asserted by the redirect rule in vercel.json. */
const PASS = 'ce2cda46b8ae09d47f8d8b2c3727d519';
const COOKIE = 'ka_pass';
const ONE_YEAR = 60 * 60 * 24 * 365;

const notFound = () =>
  new Response('Not Found', {
    status: 404,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow'
    }
  });

/** Length-independent compare, so a wrong key leaks nothing through timing. */
function sameKey(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export default function handler(request: Request): Response {
  const key = process.env.SITE_KEY;
  const supplied = new URL(request.url).searchParams.get('k');

  // An unset SITE_KEY cannot mean "let everyone in" here — the redirect rule
  // in vercel.json is unconditional, so every visitor lands on this function
  // and there would be no way to tell them apart. It means nobody gets in,
  // which is loud and obvious rather than silently open.
  if (!key || supplied === null || !sameKey(supplied, key)) return notFound();

  return new Response(null, {
    status: 302,
    headers: {
      // Straight to the map, and the key never reaches the address bar, so it
      // cannot end up in history, a screenshot of the kiosk, or a Referer
      // header on the way to Mapbox.
      Location: '/',
      'Set-Cookie':
        `${COOKIE}=${PASS}; Path=/; Max-Age=${ONE_YEAR}; ` +
        'HttpOnly; Secure; SameSite=Lax',
      'Cache-Control': 'no-store'
    }
  });
}
