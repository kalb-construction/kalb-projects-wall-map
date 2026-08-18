export const config = { runtime: 'edge' };

import { hasAccess } from './_shared';
import { PROTECTED } from './_protected.generated';

/**
 * Serves the actual project data and the internal tools -- job numbers,
 * addresses, PM names, square footage -- behind the access gate.
 *
 * Two earlier attempts at this gate used a conditional redirect/rewrite in
 * vercel.json (a regex source, a "missing cookie" condition) and both
 * silently failed to fire -- the plain URL kept loading the map. Rather
 * than keep guessing at routing syntax with no way to test it against the
 * real edge network, this sidesteps the whole class of bug: Vercel always
 * lets a static file in dist/ win over a rewrite at the same path (the
 * filesystem is checked before rewrites), so no conditional rule can ever
 * be relied on to intercept a file that is still sitting there. The build
 * step (scripts/protect-build.mjs) removes everything under data/ and
 * tools/ from dist/ and embeds it here as plain string constants instead --
 * so there is nothing left in the static output for the filesystem to
 * find, and the unconditional rewrites in vercel.json ("/data/*",
 * "/tools/*" → here) become the only possible match.
 *
 * index.html and the JS/CSS bundle are deliberately NOT routed through
 * here -- see scripts/protect-build.mjs for why. An ungated visitor gets
 * the real app shell: branding, the empty map, the UI chrome. What they
 * cannot get is any project data, because this function is the only source
 * of it and it 404s without the cookie. No pins, no job numbers, no
 * addresses, no names -- just an empty map.
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
  const pathname = new URL(request.url).pathname;
  const entry = PROTECTED[pathname];

  // Check both the path is one we actually embedded and that access was
  // granted, and 404 either way -- a stranger sees no difference between
  // "wrong path" and "right path, no cookie", so there is nothing to probe.
  if (!entry || !hasAccess(request)) return notFound();

  return new Response(entry.body, {
    status: 200,
    headers: {
      'Content-Type': entry.contentType,
      'Cache-Control': 'no-store, must-revalidate',
      'X-Robots-Tag': 'noindex, nofollow'
    }
  });
}
