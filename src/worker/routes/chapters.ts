import { Hono } from "hono";
import type { AppEnv } from "../hono-env";
import { getCurrentUser } from "../lib/current-user";

export const chaptersRoutes = new Hono<AppEnv>();
export const chapterActionsRoutes = new Hono<AppEnv>();

// GET /api/stories/:slug/chapters/:number
chaptersRoutes.get("/:slug/chapters/:number", async (c) => {
  const user = await getCurrentUser(c);
  const number = Number(c.req.param("number"));
  const lang = c.req.query("lang") ?? "en";
  const result = await c.get("services").chapterService.getChapter(c.req.param("slug"), number, user?.id ?? null, lang);

  if (result.kind === "not_found") return c.json({ error: "Chapter not found" }, 404);
  if (result.kind === "locked") {
    return c.json(
      { error: "Login required to read this chapter", locked: true, chapterNumber: result.chapterNumber },
      401
    );
  }

  return c.json({
    chapter: result.chapter,
    storyTitle: result.storyTitle,
    storyCoverImageUrl: result.storyCoverImageUrl,
    likeCount: result.likeCount,
    likedByMe: result.likedByMe,
    nextChapterNumber: result.nextChapterNumber,
    translationLang: result.translationLang,
    translationAvailable: result.translationAvailable,
  });
});

chapterActionsRoutes.post("/chapters/:id/like", async (c) => {
  const user = await getCurrentUser(c);
  if (!user) return c.json({ error: "Login required" }, 401);

  const result = await c.get("services").chapterService.like(user.id, Number(c.req.param("id")));
  if ("error" in result) return c.json(result, 403);
  return c.json(result);
});

chapterActionsRoutes.delete("/chapters/:id/like", async (c) => {
  const user = await getCurrentUser(c);
  if (!user) return c.json({ error: "Login required" }, 401);

  await c.get("services").chapterService.unlike(user.id, Number(c.req.param("id")));
  return c.json({ ok: true });
});
