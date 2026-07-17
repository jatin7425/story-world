import type { Context } from "hono";

const SESSION_COOKIE = "session";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export function setSessionCookie(c: Context, token: string) {
  const maxAge = Math.floor(SESSION_TTL_MS / 1000);
  c.header("Set-Cookie", `${SESSION_COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`);
}

export function clearSessionCookie(c: Context) {
  c.header("Set-Cookie", `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`);
}

export function readSessionCookie(c: Context): string | null {
  const header = c.req.header("Cookie");
  if (!header) return null;
  const match = header.match(new RegExp(`(?:^|; )${SESSION_COOKIE}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}
