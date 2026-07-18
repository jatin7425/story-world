import { Hono } from "hono";
import type { AppEnv } from "../hono-env";
import { adminGuard } from "../lib/admin-guard";
import { getCurrentUser } from "../lib/current-user";
import { isSupportedLang } from "../lib/translation-prompt";

export const adminTranslationJobsRoutes = new Hono<AppEnv>();
adminTranslationJobsRoutes.use("*", adminGuard);

adminTranslationJobsRoutes.post("/translation-jobs", async (c) => {
  const user = (await getCurrentUser(c))!;

  const body = await c.req.json<{ storyId?: number; chapterIds?: number[]; includeStory?: boolean; langs?: string[] }>();
  const storyId = Number(body.storyId);
  if (!Number.isFinite(storyId)) return c.json({ error: "storyId is required" }, 400);

  const chapterIds = Array.isArray(body.chapterIds) ? body.chapterIds.map(Number).filter(Number.isFinite) : [];
  const langs = (Array.isArray(body.langs) ? body.langs : []).filter(isSupportedLang);
  if (langs.length === 0) return c.json({ error: "Select at least one language" }, 400);

  try {
    const result = await c.get("services").translationJobService.createJob(
      { storyId, chapterIds, includeStory: !!body.includeStory, langs },
      user.id
    );
    return c.json(result);
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "Failed to create translation job" }, 400);
  }
});

adminTranslationJobsRoutes.post("/translation-jobs/:id/step", async (c) => {
  const jobId = Number(c.req.param("id"));
  if (!Number.isFinite(jobId)) return c.json({ error: "Invalid job id" }, 400);

  const result = await c.get("services").translationJobService.stepJob(jobId);
  return c.json(result);
});

adminTranslationJobsRoutes.get("/translation-jobs/:id", async (c) => {
  const jobId = Number(c.req.param("id"));
  if (!Number.isFinite(jobId)) return c.json({ error: "Invalid job id" }, 400);

  const result = await c.get("services").translationJobService.getJob(jobId);
  if (!result) return c.json({ error: "Job not found" }, 404);
  return c.json(result);
});
