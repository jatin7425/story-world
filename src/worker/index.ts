import { Hono } from "hono";
import type { AppEnv } from "./hono-env";
import { createContainer } from "./container";
import { authRoutes } from "./routes/auth";
import { storiesRoutes } from "./routes/stories";
import { chaptersRoutes, chapterActionsRoutes } from "./routes/chapters";
import { commentsRoutes } from "./routes/comments";
import { adminStoriesRoutes } from "./routes/admin-stories";
import { adminUsersRoutes } from "./routes/admin-users";
import { adminMcpRoutes } from "./routes/admin-mcp";
import { adminImagesRoutes } from "./routes/admin-images";
import { profileRoutes } from "./routes/profile";
import { mcpRoutes } from "./routes/mcp";
import { imagesRoutes } from "./routes/images";
import { oauthRoutes, oauthWellKnownRoutes } from "./routes/oauth";
import { defaultMeta, servePageWithMeta, truncateForDescription } from "./lib/seo";

const app = new Hono<AppEnv>();

app.use("*", async (c, next) => {
  c.set("services", createContainer(c.env));
  await next();
});

app.route("/auth", authRoutes);
app.route("/api/stories", storiesRoutes);
app.route("/api/stories", chaptersRoutes); // adds GET /api/stories/:slug/chapters/:number
app.route("/api", chapterActionsRoutes); // adds /api/chapters/:id/like
app.route("/api", commentsRoutes); // adds /api/chapters/:id/comments
app.route("/api/admin", adminStoriesRoutes);
app.route("/api/admin", adminUsersRoutes);
app.route("/api/admin/mcp", adminMcpRoutes);
app.route("/api/admin", adminImagesRoutes);
app.route("/api/profile", profileRoutes);
app.route("/mcp", mcpRoutes);
app.route("/images", imagesRoutes);
app.route("/oauth", oauthRoutes);
app.route("/.well-known", oauthWellKnownRoutes);

// HTML page routes below get per-page <title>/meta/OG tags injected into the
// SPA shell for search + social-share previews. Everything else (login,
// profile, admin, unknown paths) falls through to the catch-all, which just
// serves the SPA shell unchanged via the ASSETS binding's SPA fallback.
//
// "/" itself isn't handled here: Cloudflare's static-assets layer serves an
// exact-match file (index.html) before the Worker ever runs, so a route here
// would be dead code. The homepage's meta tags are instead baked directly
// into index.html.

app.get("/stories/:slug", async (c) => {
  const origin = new URL(c.req.url).origin;
  const story = await c.get("services").storyService.findStoryMeta(c.req.param("slug"));

  if (!story) return servePageWithMeta(c.env, c.req.raw, defaultMeta(origin));

  return servePageWithMeta(c.env, c.req.raw, {
    title: `${story.title} — StoryGlobal`,
    description: story.description
      ? truncateForDescription(story.description)
      : `Read "${story.title}" on StoryGlobal.`,
    url: c.req.url,
    image: story.cover_image_url,
  });
});

app.get("/stories/:slug/chapters/:number", async (c) => {
  const origin = new URL(c.req.url).origin;
  const number = Number(c.req.param("number"));
  const meta = await c.get("services").chapterService.findChapterMeta(c.req.param("slug"), number);

  if (!meta) return servePageWithMeta(c.env, c.req.raw, defaultMeta(origin));

  const chapterLabel = meta.chapterTitle ? `Chapter ${number}: ${meta.chapterTitle}` : `Chapter ${number}`;
  return servePageWithMeta(c.env, c.req.raw, {
    title: `${chapterLabel} — ${meta.storyTitle} — StoryGlobal`,
    description: truncateForDescription(meta.content),
    url: c.req.url,
    image: meta.coverImageUrl,
    type: "article",
  });
});

app.get("/robots.txt", (c) => {
  const origin = new URL(c.req.url).origin;
  // Note: deliberately no entry for the admin path here — robots.txt is
  // public, and listing a "hidden" admin URL is exactly how bots find it.
  const body = [
    "User-agent: *",
    "Disallow: /profile",
    "Disallow: /api/",
    "Disallow: /auth/",
    "Disallow: /mcp",
    "Disallow: /oauth",
    `Sitemap: ${origin}/sitemap.xml`,
    "",
  ].join("\n");
  return c.text(body, 200, { "Content-Type": "text/plain; charset=utf-8" });
});

app.get("/sitemap.xml", async (c) => {
  const origin = new URL(c.req.url).origin;
  const { results } = await c.env.DB.prepare(
    `SELECT s.slug as story_slug, s.created_at as story_created_at,
            c.chapter_number, c.created_at as chapter_created_at
     FROM stories s
     LEFT JOIN chapters c ON c.story_id = s.id AND c.status = 'published'
     WHERE s.status = 'published'
     ORDER BY s.slug, c.chapter_number`
  ).all<{
    story_slug: string;
    story_created_at: string;
    chapter_number: number | null;
    chapter_created_at: string | null;
  }>();

  const urlEntry = (loc: string, lastmod?: string | null) =>
    `  <url><loc>${loc}</loc>${lastmod ? `<lastmod>${lastmod.slice(0, 10)}</lastmod>` : ""}</url>`;

  const urls = [urlEntry(`${origin}/`)];
  const seenStories = new Set<string>();
  for (const row of results) {
    if (!seenStories.has(row.story_slug)) {
      seenStories.add(row.story_slug);
      urls.push(urlEntry(`${origin}/stories/${row.story_slug}`, row.story_created_at));
    }
    if (row.chapter_number != null) {
      urls.push(
        urlEntry(`${origin}/stories/${row.story_slug}/chapters/${row.chapter_number}`, row.chapter_created_at)
      );
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>`;
  return c.text(xml, 200, { "Content-Type": "application/xml; charset=utf-8" });
});

app.get("*", (c) => c.env.ASSETS.fetch(c.req.raw));

export default {
  fetch: app.fetch,
} satisfies ExportedHandler<AppEnv["Bindings"]>;
