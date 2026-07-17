import type { Context } from "hono";
import type { Env, AuthUser } from "../types";

const SESSION_COOKIE = "session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const MAGIC_LINK_TTL_MS = 15 * 60 * 1000; // 15 minutes

function randomToken(): string {
  return crypto.randomUUID() + crypto.randomUUID();
}

export async function createMagicLinkToken(db: D1Database, email: string): Promise<string> {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + MAGIC_LINK_TTL_MS).toISOString();
  await db
    .prepare("INSERT INTO magic_link_tokens (token, email, expires_at) VALUES (?, ?, ?)")
    .bind(token, email, expiresAt)
    .run();
  return token;
}

export async function consumeMagicLinkToken(db: D1Database, token: string): Promise<string | null> {
  const row = await db
    .prepare("SELECT email, expires_at, used_at FROM magic_link_tokens WHERE token = ?")
    .bind(token)
    .first<{ email: string; expires_at: string; used_at: string | null }>();

  if (!row || row.used_at) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) return null;

  await db
    .prepare("UPDATE magic_link_tokens SET used_at = CURRENT_TIMESTAMP WHERE token = ?")
    .bind(token)
    .run();

  return row.email;
}

export async function findOrCreateUser(db: D1Database, email: string): Promise<AuthUser> {
  const existing = await db
    .prepare("SELECT id, email, display_name, role FROM users WHERE email = ?")
    .bind(email)
    .first<AuthUser>();
  if (existing) return existing;

  const result = await db
    .prepare("INSERT INTO users (email) VALUES (?) RETURNING id, email, display_name, role")
    .bind(email)
    .first<AuthUser>();
  return result!;
}

export async function createSession(db: D1Database, userId: number): Promise<string> {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  await db
    .prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)")
    .bind(token, userId, expiresAt)
    .run();
  return token;
}

export function setSessionCookie(c: Context, token: string) {
  const maxAge = Math.floor(SESSION_TTL_MS / 1000);
  c.header(
    "Set-Cookie",
    `${SESSION_COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`
  );
}

export function clearSessionCookie(c: Context) {
  c.header("Set-Cookie", `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`);
}

function readCookie(c: Context, name: string): string | null {
  const header = c.req.header("Cookie");
  if (!header) return null;
  const match = header.match(new RegExp(`(?:^|; )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export async function getCurrentUser(c: Context<{ Bindings: Env }>): Promise<AuthUser | null> {
  const token = readCookie(c, SESSION_COOKIE);
  if (!token) return null;

  const row = await c.env.DB.prepare(
    `SELECT u.id, u.email, u.display_name, u.role
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token = ? AND s.expires_at > CURRENT_TIMESTAMP`
  )
    .bind(token)
    .first<AuthUser>();

  return row ?? null;
}

export async function requireUser(c: Context<{ Bindings: Env }>): Promise<AuthUser | null> {
  const user = await getCurrentUser(c);
  return user;
}

export function requireAdmin(user: AuthUser | null): user is AuthUser {
  return !!user && user.role === "admin";
}
