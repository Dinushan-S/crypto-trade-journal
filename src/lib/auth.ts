import type { Cookies } from '@sveltejs/kit';

export const TOKEN_COOKIE = 'convexAuthToken';
export const REFRESH_COOKIE = 'convexAuthRefreshToken';

const opts = { path: '/', httpOnly: true, sameSite: 'lax' as const, secure: process.env.NODE_ENV === 'production' };

export function setAuthCookies(cookies: Cookies, tokens: { token: string; refreshToken: string }) {
  cookies.set(TOKEN_COOKIE, tokens.token, { ...opts, maxAge: 60 * 60 });
  cookies.set(REFRESH_COOKIE, tokens.refreshToken, { ...opts, maxAge: 60 * 60 * 24 * 30 });
}

export function clearAuthCookies(cookies: Cookies) {
  cookies.delete(TOKEN_COOKIE, opts);
  cookies.delete(REFRESH_COOKIE, opts);
}

/** Reads `exp` from a JWT without verifying it — Convex verifies for real on every call. */
export function isExpired(token: string, skewSeconds = 60): boolean {
  try {
    const { exp } = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof exp !== 'number' || Date.now() / 1000 > exp - skewSeconds;
  } catch {
    return true;
  }
}
