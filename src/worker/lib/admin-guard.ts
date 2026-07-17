import type { Context, Next } from "hono";
import type { AppEnv } from "../hono-env";
import { requireAdmin } from "./auth";
import { getCurrentUser } from "./current-user";

export async function adminGuard(c: Context<AppEnv>, next: Next) {
  const user = await getCurrentUser(c);
  if (!requireAdmin(user)) return c.json({ error: "Admin access required" }, 403);
  await next();
}
