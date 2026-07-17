import { Hono } from "hono";
import type { AppEnv } from "../hono-env";
import { adminGuard } from "../lib/admin-guard";
import { parseAdminPagination } from "../lib/pagination";
import type { ChapterContentFormat } from "../repositories/types";

export const adminStoriesRoutes = new Hono<AppEnv>();
adminStoriesRoutes.use("*", adminGuard);

function parseContentFormat(value: unknown): ChapterContentFormat | undefined {
  return value === "html" || value === "markdown" ? value : undefined;
}

adminStoriesRoutes.get("/stories", async (c) => {
  const { page, limit } = parseAdminPagination(c);
  const { items, total, totalPages } = await c.get("services").adminStoryService.listStories(page, limit);
  return c.json({ stories: items, total, page, limit, totalPages });
});

adminStoriesRoutes.post("/stories", async (c) => {
  const body = await c.req.json<{
    title?: string;
    description?: string;
    cover_image_url?: string;
    free_chapter_count?: number;
    tags?: string;
  }>();

  if (!body.title) return c.json({ error: "Title required" }, 400);

  const story = await c.get("services").adminStoryService.createStory({
    title: body.title,
    description: body.description,
    coverImageUrl: body.cover_image_url,
    freeChapterCount: body.free_chapter_count,
    tags: body.tags,
  });

  return c.json({ story });
});

adminStoriesRoutes.patch("/stories/:id", async (c) => {
  const body = await c.req.json<{
    title?: string;
    description?: string | null;
    cover_image_url?: string | null;
    free_chapter_count?: number;
    status?: string;
    tags?: string | null;
  }>();

  const story = await c.get("services").adminStoryService.updateStory(Number(c.req.param("id")), {
    title: body.title,
    description: body.description,
    coverImageUrl: body.cover_image_url,
    freeChapterCount: body.free_chapter_count,
    status: body.status,
    tags: body.tags,
  });

  if (!story) return c.json({ error: "Story not found" }, 404);
  return c.json({ story });
});

adminStoriesRoutes.delete("/stories/:id", async (c) => {
  await c.get("services").adminStoryService.deleteStory(Number(c.req.param("id")));
  return c.json({ ok: true });
});

adminStoriesRoutes.get("/stories/:id", async (c) => {
  const story = await c.get("services").adminStoryService.getStory(Number(c.req.param("id")));
  if (!story) return c.json({ error: "Story not found" }, 404);
  return c.json({ story });
});

adminStoriesRoutes.get("/stories/:id/chapters", async (c) => {
  const { page, limit } = parseAdminPagination(c);
  const { items, total, totalPages } = await c
    .get("services")
    .adminStoryService.listChapters(Number(c.req.param("id")), page, limit);
  return c.json({ chapters: items, total, page, limit, totalPages });
});

adminStoriesRoutes.get("/stories/:id/chapters/:number", async (c) => {
  const chapter = await c
    .get("services")
    .adminStoryService.getChapter(Number(c.req.param("id")), Number(c.req.param("number")));
  if (!chapter) return c.json({ error: "Chapter not found" }, 404);
  return c.json({ chapter });
});

adminStoriesRoutes.patch("/stories/:id/chapters/:number", async (c) => {
  const body = await c.req.json<{
    title?: string | null;
    content?: string;
    content_format?: string;
    image_url?: string | null;
  }>();
  const chapter = await c.get("services").adminStoryService.updateChapter(
    Number(c.req.param("id")),
    Number(c.req.param("number")),
    {
      title: body.title,
      content: body.content,
      contentFormat: parseContentFormat(body.content_format),
      imageUrl: body.image_url,
    }
  );
  if (!chapter) return c.json({ error: "Chapter not found" }, 404);
  return c.json({ chapter });
});

adminStoriesRoutes.post("/stories/:id/chapters", async (c) => {
  const body = await c.req.json<{ title?: string; content?: string; content_format?: string; image_url?: string }>();
  if (!body.content) return c.json({ error: "Chapter content required" }, 400);

  const chapter = await c.get("services").adminStoryService.addChapter(Number(c.req.param("id")), {
    title: body.title,
    content: body.content,
    contentFormat: parseContentFormat(body.content_format),
    imageUrl: body.image_url,
  });

  return c.json({ chapter });
});

adminStoriesRoutes.delete("/stories/:id/chapters/:number", async (c) => {
  await c
    .get("services")
    .adminStoryService.deleteChapter(Number(c.req.param("id")), Number(c.req.param("number")));
  return c.json({ ok: true });
});

adminStoriesRoutes.post("/stories/:id/chapters/:number/publish", async (c) => {
  const chapter = await c
    .get("services")
    .adminStoryService.publishChapter(Number(c.req.param("id")), Number(c.req.param("number")));
  if (!chapter) return c.json({ error: "Chapter not found" }, 404);
  return c.json({ chapter });
});

adminStoriesRoutes.post("/stories/:id/chapters/:number/unpublish", async (c) => {
  const chapter = await c
    .get("services")
    .adminStoryService.unpublishChapter(Number(c.req.param("id")), Number(c.req.param("number")));
  if (!chapter) return c.json({ error: "Chapter not found" }, 404);
  return c.json({ chapter });
});
