import { Hono } from "hono";
import type { AppEnv } from "../hono-env";
import { getCurrentUser } from "../lib/current-user";
import { parseReaderPage } from "../lib/pagination";
import { clearSessionCookie } from "../lib/session-cookie";

export const profileRoutes = new Hono<AppEnv>();

profileRoutes.get("/", async (c) => {
  const user = await getCurrentUser(c);
  if (!user) return c.json({ error: "Login required" }, 401);

  const { page: followedPage, limit } = parseReaderPage(c, "followed_page");
  const { page: commentsPage } = parseReaderPage(c, "comments_page");
  const profile = await c.get("services").profileService.getProfile(user, followedPage, commentsPage, limit);
  return c.json({
    user: profile.user,
    followedStories: profile.followedStories.items,
    followedTotal: profile.followedStories.total,
    followedPage: profile.followedStories.page,
    followedTotalPages: profile.followedStories.totalPages,
    recentComments: profile.recentComments.items,
    commentsTotal: profile.recentComments.total,
    commentsPage: profile.recentComments.page,
    commentsTotalPages: profile.recentComments.totalPages,
    likesGiven: profile.likesGiven,
  });
});

profileRoutes.patch("/", async (c) => {
  const user = await getCurrentUser(c);
  if (!user) return c.json({ error: "Login required" }, 401);

  const body = await c.req.json<{ display_name?: string | null; username?: string | null }>();
  const displayName = body.display_name?.trim() || null;
  const username = body.username?.trim() || null;

  const result = await c.get("services").profileService.updateProfile(user.id, displayName, username);
  if ("error" in result) return c.json(result, 400);
  return c.json({ user: result });
});

profileRoutes.post("/logout-all", async (c) => {
  const user = await getCurrentUser(c);
  if (!user) return c.json({ error: "Login required" }, 401);

  await c.get("services").authService.logoutAll(user.id);
  clearSessionCookie(c);
  return c.json({ ok: true });
});

profileRoutes.patch("/gender", async (c) => {
  const user = await getCurrentUser(c);
  if (!user) return c.json({ error: "Login required" }, 401);

  const { gender } = await c.req.json<{ gender?: string | null }>();
  const result = await c.get("services").profileService.updateGender(user.id, gender ?? null);
  if ("error" in result) return c.json(result, 400);
  return c.json({ user: result });
});

profileRoutes.patch("/birthdate", async (c) => {
  const user = await getCurrentUser(c);
  if (!user) return c.json({ error: "Login required" }, 401);

  const { birthdate } = await c.req.json<{ birthdate?: string }>();
  if (!birthdate) return c.json({ error: "Birthdate required" }, 400);

  const result = await c.get("services").profileService.updateBirthdate(user.id, birthdate);
  if ("error" in result) return c.json(result, 400);
  return c.json({ user: result });
});

profileRoutes.patch("/password", async (c) => {
  const user = await getCurrentUser(c);
  if (!user) return c.json({ error: "Login required" }, 401);

  const { current_password, new_password } = await c.req.json<{
    current_password?: string;
    new_password?: string;
  }>();
  if (!current_password || !new_password) {
    return c.json({ error: "Current and new password required" }, 400);
  }

  const result = await c.get("services").authService.changePassword(user.id, current_password, new_password);
  if ("error" in result) return c.json({ error: result.error }, result.status);
  return c.json(result);
});
