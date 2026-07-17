import { Hono } from "hono";
import type { Env } from "../types";
import { getCurrentUser } from "../lib/auth";

export const chaptersRoutes = new Hono<{ Bindings: Env }>();
export const chapterActionsRoutes = new Hono<{ Bindings: Env }>();

// GET /api/stories/:slug/chapters/:number
chaptersRoutes.get("/:slug/chapters/:number", async (c) => {
  const slug = c.req.param("slug");
  const chapterNumber = Number(c.req.param("number"));

  const story = await c.env.DB.prepare(
    "SELECT id, free_chapter_count FROM stories WHERE slug = ? AND status = 'published'"
  )
    .bind(slug)
    .first<{ id: number; free_chapter_count: number }>();
  if (!story) return c.json({ error: "Story not found" }, 404);

  const chapter = await c.env.DB.prepare(
    "SELECT id, chapter_number, title, content FROM chapters WHERE story_id = ? AND chapter_number = ?"
  )
    .bind(story.id, chapterNumber)
    .first<{ id: number; chapter_number: number; title: string | null; content: string }>();
  if (!chapter) return c.json({ error: "Chapter not found" }, 404);

  // Gate: chapters beyond the story's free_chapter_count require login.
  // Centralized here so a future paid-tier check can replace/extend this
  // single condition without touching callers.
  const isFree = chapter.chapter_number <= story.free_chapter_count;
  if (!isFree) {
    const user = await getCurrentUser(c);
    if (!user) {
      return c.json(
        { error: "Login required to read this chapter", locked: true, chapterNumber: chapter.chapter_number },
        401
      );
    }
  }

  const likeCount = await c.env.DB.prepare(
    "SELECT COUNT(*) as count FROM likes WHERE chapter_id = ?"
  )
    .bind(chapter.id)
    .first<{ count: number }>();

  const user = await getCurrentUser(c);
  let likedByMe = false;
  if (user) {
    const row = await c.env.DB.prepare(
      "SELECT 1 FROM likes WHERE user_id = ? AND chapter_id = ?"
    )
      .bind(user.id, chapter.id)
      .first();
    likedByMe = !!row;
  }

  return c.json({ chapter, likeCount: likeCount?.count ?? 0, likedByMe });
});

chapterActionsRoutes.post("/chapters/:id/like", async (c) => {
  const user = await getCurrentUser(c);
  if (!user) return c.json({ error: "Login required" }, 401);

  const chapterId = Number(c.req.param("id"));
  await c.env.DB.prepare(
    "INSERT OR IGNORE INTO likes (user_id, chapter_id) VALUES (?, ?)"
  )
    .bind(user.id, chapterId)
    .run();

  return c.json({ ok: true });
});

chapterActionsRoutes.delete("/chapters/:id/like", async (c) => {
  const user = await getCurrentUser(c);
  if (!user) return c.json({ error: "Login required" }, 401);

  const chapterId = Number(c.req.param("id"));
  await c.env.DB.prepare("DELETE FROM likes WHERE user_id = ? AND chapter_id = ?")
    .bind(user.id, chapterId)
    .run();

  return c.json({ ok: true });
});
