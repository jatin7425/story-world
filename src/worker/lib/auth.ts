import type { AuthUser } from "../types";

const PBKDF2_ITERATIONS = 100_000;

export function randomToken(): string {
  return crypto.randomUUID() + crypto.randomUUID();
}

function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function fromBase64(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

/** Stores as "iterations:saltBase64:hashBase64" so verify can adapt if iterations ever change. */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derivePasswordBits(password, salt, PBKDF2_ITERATIONS);
  return `${PBKDF2_ITERATIONS}:${toBase64(salt)}:${toBase64(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [iterationsStr, saltB64, hashB64] = stored.split(":");
  const iterations = Number(iterationsStr);
  if (!iterations || !saltB64 || !hashB64) return false;

  const salt = fromBase64(saltB64);
  const expected = fromBase64(hashB64);
  const actual = await derivePasswordBits(password, salt, iterations);

  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
  return diff === 0;
}

async function derivePasswordBits(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as BufferSource, iterations, hash: "SHA-256" },
    keyMaterial,
    256
  );
  return new Uint8Array(bits);
}

export function requireAdmin(user: AuthUser | null): user is AuthUser {
  return !!user && user.role === "admin";
}
