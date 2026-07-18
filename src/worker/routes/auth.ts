import { Hono } from "hono";
import type { AppEnv } from "../hono-env";
import { setSessionCookie, clearSessionCookie } from "../lib/session-cookie";
import { getCurrentUser } from "../lib/current-user";

export const authRoutes = new Hono<AppEnv>();

authRoutes.post("/request-link", async (c) => {
  const { email } = await c.req.json<{ email?: string }>();
  if (!email || !email.includes("@")) return c.json({ error: "Valid email required" }, 400);

  const appUrl = new URL(c.req.url).origin;
  await c.get("services").authService.requestMagicLink(email.toLowerCase().trim(), appUrl);
  return c.json({ ok: true });
});

authRoutes.get("/verify", async (c) => {
  const token = c.req.query("token");
  if (!token) return c.json({ error: "Missing token" }, 400);

  const sessionToken = await c.get("services").authService.verifyMagicLink(token);
  if (!sessionToken) return c.json({ error: "Invalid or expired link" }, 400);

  setSessionCookie(c, sessionToken);
  return c.redirect("/");
});

authRoutes.post("/signup", async (c) => {
  const body = await c.req.json<{
    email?: string;
    password?: string;
    username?: string;
    mobile?: string;
    gender?: string;
    preferred_lang?: string;
    secondary_lang?: string;
  }>();
  const email = body.email?.toLowerCase().trim();
  if (!email || !email.includes("@")) return c.json({ error: "Valid email required" }, 400);

  const result = await c.get("services").authService.signup({
    email,
    password: body.password ?? "",
    username: body.username?.trim() || null,
    mobile: body.mobile?.trim() || null,
    gender: body.gender || null,
    preferred_lang: body.preferred_lang || null,
    secondary_lang: body.secondary_lang || null,
  });
  if ("error" in result) return c.json({ error: result.error }, result.status);

  setSessionCookie(c, result.sessionToken);
  return c.json({ user: result.user });
});

authRoutes.post("/login", async (c) => {
  const { email, password } = await c.req.json<{ email?: string; password?: string }>();
  if (!email || !password) return c.json({ error: "Email and password required" }, 400);

  const result = await c.get("services").authService.login(email.toLowerCase().trim(), password);
  if ("error" in result) return c.json({ error: result.error }, result.status);

  setSessionCookie(c, result.sessionToken);
  return c.json({ user: result.user });
});

authRoutes.post("/logout", async (c) => {
  clearSessionCookie(c);
  return c.json({ ok: true });
});

authRoutes.get("/me", async (c) => {
  const user = await getCurrentUser(c);
  return c.json({ user });
});
