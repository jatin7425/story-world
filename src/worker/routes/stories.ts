import { Hono } from "hono";
import type { AppEnv } from "../hono-env";
import { getCurrentUser } from "../lib/current-user";

export const storiesRoutes = new Hono<AppEnv>();

storiesRoutes.get("/", async (c) => {
  const stories = await c.get("services").storyService.listStories(c.req.query("q"));
  return c.json({ stories });
});

storiesRoutes.get("/:slug", async (c) => {
  const user = await getCurrentUser(c);
  const detail = await c.get("services").storyService.getStoryDetail(c.req.param("slug"), user?.id ?? null);
  if (!detail) return c.json({ error: "Story not found" }, 404);
  return c.json({ ...detail, isLoggedIn: !!user });
});

storiesRoutes.post("/:slug/follow", async (c) => {
  const user = await getCurrentUser(c);
  if (!user) return c.json({ error: "Login required" }, 401);

  const result = await c.get("services").storyService.follow(user.id, c.req.param("slug"));
  if ("error" in result) return c.json(result, 404);
  return c.json(result);
});

storiesRoutes.delete("/:slug/follow", async (c) => {
  const user = await getCurrentUser(c);
  if (!user) return c.json({ error: "Login required" }, 401);

  const result = await c.get("services").storyService.unfollow(user.id, c.req.param("slug"));
  if ("error" in result) return c.json(result, 404);
  return c.json(result);
});
