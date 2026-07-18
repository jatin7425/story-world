import { Hono } from "hono";
import type { AppEnv } from "../hono-env";
import { adminGuard } from "../lib/admin-guard";

export const adminAgeRatingRoutes = new Hono<AppEnv>();
adminAgeRatingRoutes.use("*", adminGuard);

const VALID_RATINGS = ["all", "13+", "16+", "18+"];

adminAgeRatingRoutes.post("/stories/:id/age-rating/classify", async (c) => {
  const storyId = Number(c.req.param("id"));
  if (!Number.isFinite(storyId)) return c.json({ error: "Invalid story id" }, 400);

  try {
    const story = await c.get("services").ageRatingService.classifyStory(storyId);
    return c.json({ story });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "Failed to classify story" }, 400);
  }
});

adminAgeRatingRoutes.patch("/stories/:id/age-rating", async (c) => {
  const storyId = Number(c.req.param("id"));
  if (!Number.isFinite(storyId)) return c.json({ error: "Invalid story id" }, 400);

  const { rating } = await c.req.json<{ rating?: string }>();
  if (!rating || !VALID_RATINGS.includes(rating)) return c.json({ error: "Invalid rating" }, 400);

  try {
    const story = await c.get("services").ageRatingService.setManualRating(storyId, rating as "all" | "13+" | "16+" | "18+");
    return c.json({ story });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "Failed to set rating" }, 400);
  }
});
