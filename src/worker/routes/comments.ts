import { Hono } from "hono";
import type { AppEnv } from "../hono-env";
import { getCurrentUser } from "../lib/current-user";

export const commentsRoutes = new Hono<AppEnv>();

commentsRoutes.get("/chapters/:id/comments", async (c) => {
  const comments = await c.get("services").commentService.listForChapter(Number(c.req.param("id")));
  return c.json({ comments });
});

commentsRoutes.post("/chapters/:id/comments", async (c) => {
  const user = await getCurrentUser(c);
  if (!user) return c.json({ error: "Login required" }, 401);

  const { body } = await c.req.json<{ body?: string }>();
  const result = await c.get("services").commentService.addComment(user.id, Number(c.req.param("id")), body ?? "");
  if ("error" in result) return c.json({ error: result.error }, result.status);
  return c.json(result);
});
