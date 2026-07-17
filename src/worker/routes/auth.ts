import { Hono } from "hono";
import type { Env } from "../types";
import {
  createMagicLinkToken,
  consumeMagicLinkToken,
  findOrCreateUser,
  createSession,
  setSessionCookie,
  clearSessionCookie,
  getCurrentUser,
} from "../lib/auth";
import { sendMagicLinkEmail } from "../lib/email";

export const authRoutes = new Hono<{ Bindings: Env }>();

authRoutes.post("/request-link", async (c) => {
  const { email } = await c.req.json<{ email?: string }>();
  if (!email || !email.includes("@")) {
    return c.json({ error: "Valid email required" }, 400);
  }

  const token = await createMagicLinkToken(c.env.DB, email.toLowerCase().trim());
  const appUrl = new URL(c.req.url).origin;
  await sendMagicLinkEmail(c.env, appUrl, email, token);

  return c.json({ ok: true });
});

authRoutes.get("/verify", async (c) => {
  const token = c.req.query("token");
  if (!token) return c.json({ error: "Missing token" }, 400);

  const email = await consumeMagicLinkToken(c.env.DB, token);
  if (!email) return c.json({ error: "Invalid or expired link" }, 400);

  const user = await findOrCreateUser(c.env.DB, email);
  const sessionToken = await createSession(c.env.DB, user.id);
  setSessionCookie(c, sessionToken);

  return c.redirect("/");
});

authRoutes.post("/logout", async (c) => {
  clearSessionCookie(c);
  return c.json({ ok: true });
});

authRoutes.get("/me", async (c) => {
  const user = await getCurrentUser(c);
  return c.json({ user });
});
