import { Hono } from "hono";
import type { Env } from "../types";
import { getCurrentUser } from "../lib/auth";

export const storiesRoutes = new Hono<{ Bindings: Env }>();

storiesRoutes.get("/", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT id, title, slug, description, cover_image_url, free_chapter_count, created_at
     FROM stories WHERE status = 'published' ORDER BY created_at DESC`
  ).all();
  return c.json({ stories: results });
});

storiesRoutes.get("/:slug", async (c) => {
  const slug = c.req.param("slug");
  const story = await c.env.DB.prepare(
    `SELECT id, title, slug, description, cover_image_url, free_chapter_count, author_id, created_at
     FROM stories WHERE slug = ? AND status = 'published'`
  )
    .bind(slug)
    .first();

  if (!story) return c.json({ error: "Story not found" }, 404);

  const { results: chapters } = await c.env.DB.prepare(
    `SELECT id, chapter_number, title, created_at FROM chapters WHERE story_id = ? ORDER BY chapter_number ASC`
  )
    .bind(story.id)
    .all();

  const user = await getCurrentUser(c);
  const followersCount = await c.env.DB.prepare(
    `SELECT COUNT(*) as count FROM follows WHERE story_id = ?`
  )
    .bind(story.id)
    .first<{ count: number }>();

  let isFollowing = false;
  if (user) {
    const row = await c.env.DB.prepare(
      `SELECT 1 FROM follows WHERE user_id = ? AND story_id = ?`
    )
      .bind(user.id, story.id)
      .first();
    isFollowing = !!row;
  }

  return c.json({
    story,
    chapters,
    followersCount: followersCount?.count ?? 0,
    isFollowing,
    isLoggedIn: !!user,
  });
});

storiesRoutes.post("/:slug/follow", async (c) => {
  const user = await getCurrentUser(c);
  if (!user) return c.json({ error: "Login required" }, 401);

  const story = await c.env.DB.prepare("SELECT id FROM stories WHERE slug = ?")
    .bind(c.req.param("slug"))
    .first<{ id: number }>();
  if (!story) return c.json({ error: "Story not found" }, 404);

  await c.env.DB.prepare(
    "INSERT OR IGNORE INTO follows (user_id, story_id) VALUES (?, ?)"
  )
    .bind(user.id, story.id)
    .run();

  return c.json({ ok: true });
});

storiesRoutes.delete("/:slug/follow", async (c) => {
  const user = await getCurrentUser(c);
  if (!user) return c.json({ error: "Login required" }, 401);

  const story = await c.env.DB.prepare("SELECT id FROM stories WHERE slug = ?")
    .bind(c.req.param("slug"))
    .first<{ id: number }>();
  if (!story) return c.json({ error: "Story not found" }, 404);

  await c.env.DB.prepare("DELETE FROM follows WHERE user_id = ? AND story_id = ?")
    .bind(user.id, story.id)
    .run();

  return c.json({ ok: true });
});
