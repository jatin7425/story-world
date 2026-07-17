import { Hono } from "hono";
import type { AppEnv } from "../hono-env";
import { getCurrentUser } from "../lib/current-user";
import { parseReaderPagination } from "../lib/pagination";

export const commentsRoutes = new Hono<AppEnv>();

commentsRoutes.get("/chapters/:id/comments", async (c) => {
  const { page, limit } = parseReaderPagination(c);
  const { items, total, totalPages } = await c
    .get("services")
    .commentService.listForChapter(Number(c.req.param("id")), page, limit);
  return c.json({ comments: items, total, page, limit, totalPages });
});

commentsRoutes.post("/chapters/:id/comments", async (c) => {
  const user = await getCurrentUser(c);
  if (!user) return c.json({ error: "Login required" }, 401);

  const { body } = await c.req.json<{ body?: string }>();
  const result = await c.get("services").commentService.addComment(user.id, Number(c.req.param("id")), body ?? "");
  if ("error" in result) return c.json({ error: result.error }, result.status);
  return c.json(result);
});
