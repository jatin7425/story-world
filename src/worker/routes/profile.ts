import { Hono } from "hono";
import type { AppEnv } from "../hono-env";
import { getCurrentUser } from "../lib/current-user";

export const profileRoutes = new Hono<AppEnv>();

profileRoutes.get("/", async (c) => {
  const user = await getCurrentUser(c);
  if (!user) return c.json({ error: "Login required" }, 401);

  const profile = await c.get("services").profileService.getProfile(user);
  return c.json(profile);
});

profileRoutes.patch("/gender", async (c) => {
  const user = await getCurrentUser(c);
  if (!user) return c.json({ error: "Login required" }, 401);

  const { gender } = await c.req.json<{ gender?: string | null }>();
  const result = await c.get("services").profileService.updateGender(user.id, gender ?? null);
  if ("error" in result) return c.json(result, 400);
  return c.json({ user: result });
});
