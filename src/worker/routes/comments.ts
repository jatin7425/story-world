import { Hono } from "hono";
import type { Env } from "../types";
import { getCurrentUser } from "../lib/auth";

export const commentsRoutes = new Hono<{ Bindings: Env }>();

commentsRoutes.get("/chapters/:id/comments", async (c) => {
  const chapterId = Number(c.req.param("id"));
  const { results } = await c.env.DB.prepare(
    `SELECT c.id, c.body, c.created_at, u.display_name, u.email
     FROM comments c JOIN users u ON u.id = c.user_id
     WHERE c.chapter_id = ? ORDER BY c.created_at ASC`
  )
    .bind(chapterId)
    .all();
  return c.json({ comments: results });
});

commentsRoutes.post("/chapters/:id/comments", async (c) => {
  const user = await getCurrentUser(c);
  if (!user) return c.json({ error: "Login required" }, 401);

  const chapterId = Number(c.req.param("id"));
  const { body } = await c.req.json<{ body?: string }>();
  if (!body || !body.trim()) return c.json({ error: "Comment body required" }, 400);

  const result = await c.env.DB.prepare(
    "INSERT INTO comments (chapter_id, user_id, body) VALUES (?, ?, ?) RETURNING id, body, created_at"
  )
    .bind(chapterId, user.id, body.trim())
    .first();

  return c.json({ comment: result });
});
