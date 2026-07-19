import { Hono } from "hono";
import type { AppEnv } from "../hono-env";
import { getCurrentUser } from "../lib/current-user";
import { parseReaderPagination } from "../lib/pagination";
import { ageFromBirthdate } from "../lib/age";

export const storiesRoutes = new Hono<AppEnv>();

storiesRoutes.get("/", async (c) => {
  const { page = 1, limit = 10 } = parseReaderPagination(c);

  // Age-filtered listing: a logged-in user's account birthdate wins; anonymous
  // readers send their self-declared age as ?viewer_age. Neither present →
  // unfiltered, so crawlers and first-time visitors see the whole catalog.
  const user = await getCurrentUser(c);
  let viewerAge = ageFromBirthdate(user?.birthdate ?? null);
  if (viewerAge == null) {
    const param = Number(c.req.query("viewer_age"));
    if (Number.isInteger(param) && param >= 0 && param <= 120) viewerAge = param;
  }

  const { items, total, totalPages } = await c
    .get("services")
    .storyService.listStories(page, limit, c.req.query("q"), viewerAge);
  return c.json({ stories: items, total, page, limit, totalPages });
});

storiesRoutes.get("/:slug", async (c) => {
  const user = await getCurrentUser(c);
  const { page = 1, limit = 10 } = parseReaderPagination(c);
  const detail = await c.get("services").storyService.getStoryDetail(c.req.param("slug"), user?.id ?? null, page, limit);
  if (!detail) return c.json({ error: "Story not found" }, 404);

  const { chapters, ...rest } = detail;
  return c.json({
    ...rest,
    chapters: chapters.items,
    chaptersTotal: chapters.total,
    chaptersPage: chapters.page,
    chaptersTotalPages: chapters.totalPages,
    isLoggedIn: !!user,
  });
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
