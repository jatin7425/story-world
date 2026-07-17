import { Hono } from "hono";
import type { Env } from "../types";
import { getCurrentUser, requireAdmin } from "../lib/auth";

export const adminRoutes = new Hono<{ Bindings: Env }>();

adminRoutes.use("*", async (c, next) => {
  const user = await getCurrentUser(c);
  if (!requireAdmin(user)) return c.json({ error: "Admin access required" }, 403);
  await next();
});

function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

adminRoutes.post("/stories", async (c) => {
  const body = await c.req.json<{
    title?: string;
    description?: string;
    cover_image_url?: string;
    free_chapter_count?: number;
    is_ai_generated?: boolean;
    ai_generation_prompt?: string;
  }>();

  if (!body.title) return c.json({ error: "Title required" }, 400);

  const slug = slugify(body.title);
  const story = await c.env.DB.prepare(
    `INSERT INTO stories (title, slug, description, cover_image_url, free_chapter_count, is_ai_generated, ai_generation_prompt)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     RETURNING id, title, slug`
  )
    .bind(
      body.title,
      slug,
      body.description ?? null,
      body.cover_image_url ?? null,
      body.free_chapter_count ?? 3,
      body.is_ai_generated ? 1 : 0,
      body.ai_generation_prompt ?? null
    )
    .first();

  return c.json({ story });
});

adminRoutes.post("/stories/:id/chapters", async (c) => {
  const storyId = Number(c.req.param("id"));
  const body = await c.req.json<{ title?: string; content?: string }>();
  if (!body.content) return c.json({ error: "Chapter content required" }, 400);

  const last = await c.env.DB.prepare(
    "SELECT MAX(chapter_number) as max FROM chapters WHERE story_id = ?"
  )
    .bind(storyId)
    .first<{ max: number | null }>();
  const nextNumber = (last?.max ?? 0) + 1;

  const chapter = await c.env.DB.prepare(
    `INSERT INTO chapters (story_id, chapter_number, title, content, generated_by)
     VALUES (?, ?, ?, ?, 'admin')
     RETURNING id, chapter_number, title`
  )
    .bind(storyId, nextNumber, body.title ?? null, body.content)
    .first();

  return c.json({ chapter });
});
