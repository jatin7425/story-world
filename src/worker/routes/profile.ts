import { Hono } from "hono";
import type { Env } from "../types";
import { getCurrentUser } from "../lib/auth";

export const profileRoutes = new Hono<{ Bindings: Env }>();

profileRoutes.get("/", async (c) => {
  const user = await getCurrentUser(c);
  if (!user) return c.json({ error: "Login required" }, 401);

  const { results: followedStories } = await c.env.DB.prepare(
    `SELECT s.id, s.title, s.slug, s.cover_image_url
     FROM follows f JOIN stories s ON s.id = f.story_id
     WHERE f.user_id = ? ORDER BY f.created_at DESC`
  )
    .bind(user.id)
    .all();

  const { results: comments } = await c.env.DB.prepare(
    `SELECT c.id, c.body, c.created_at, ch.chapter_number, s.title as story_title, s.slug as story_slug
     FROM comments c
     JOIN chapters ch ON ch.id = c.chapter_id
     JOIN stories s ON s.id = ch.story_id
     WHERE c.user_id = ? ORDER BY c.created_at DESC LIMIT 20`
  )
    .bind(user.id)
    .all();

  return c.json({ user, followedStories, recentComments: comments });
});
