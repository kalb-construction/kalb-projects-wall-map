/**
 * Shared between api/gate.ts and api/serve.ts: the single unforgeable proof
 * that a browser came in through the gate.
 *
 * The cookie is HttpOnly, so a page cannot read, set, or overwrite it via
 * script -- the only way to acquire it is a Set-Cookie from api/gate.ts,
 * which only sends one after the SITE_KEY check passes. That is what makes
 * checking just the cookie's presence (not re-checking SITE_KEY on every
 * request) safe.
 */

export const COOKIE = 'ka_pass';
export const PASS = 'ce2cda46b8ae09d47f8d8b2c3727d519';
export const ONE_YEAR = 60 * 60 * 24 * 365;

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

/** Length-independent compare, so a wrong value leaks nothing through timing. */
export function sameValue(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function hasAccess(request: Request): boolean {
  const held = readCookie(request.headers.get('cookie'), COOKIE);
  return held !== null && sameValue(held, PASS);
}
