import { Hono } from "hono";
import type { Env } from "./types";
import { authRoutes } from "./routes/auth";
import { storiesRoutes } from "./routes/stories";
import { chaptersRoutes, chapterActionsRoutes } from "./routes/chapters";
import { commentsRoutes } from "./routes/comments";
import { adminRoutes } from "./routes/admin";
import { profileRoutes } from "./routes/profile";
import { runDailyChapterGeneration } from "./cron";

const app = new Hono<{ Bindings: Env }>();

app.route("/auth", authRoutes);
app.route("/api/stories", storiesRoutes);
app.route("/api/stories", chaptersRoutes); // adds GET /api/stories/:slug/chapters/:number
app.route("/api", chapterActionsRoutes); // adds /api/chapters/:id/like
app.route("/api", commentsRoutes); // adds /api/chapters/:id/comments
app.route("/api/admin", adminRoutes);
app.route("/api/profile", profileRoutes);

export default {
  fetch: app.fetch,
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runDailyChapterGeneration(env));
  },
} satisfies ExportedHandler<Env>;
