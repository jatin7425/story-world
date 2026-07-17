import { Hono } from "hono";
import type { AppEnv } from "../hono-env";
import { adminGuard } from "../lib/admin-guard";
import { getCurrentUser } from "../lib/current-user";
import { parseAdminPagination } from "../lib/pagination";

export const adminMcpRoutes = new Hono<AppEnv>();
adminMcpRoutes.use("*", adminGuard);

adminMcpRoutes.get("/tokens", async (c) => {
  const { page, limit } = parseAdminPagination(c);
  const { items, total, totalPages } = await c.get("services").mcpTokenService.list(page, limit);
  return c.json({ tokens: items, total, page, limit, totalPages });
});

adminMcpRoutes.post("/tokens", async (c) => {
  const { name } = await c.req.json<{ name?: string }>();
  if (!name || !name.trim()) return c.json({ error: "Name required" }, 400);

  // adminGuard already confirmed a real admin session exists.
  const admin = (await getCurrentUser(c))!;
  const { token, record } = await c.get("services").mcpTokenService.generate(name, admin.id);
  return c.json({ token, record });
});

adminMcpRoutes.delete("/tokens/:id", async (c) => {
  await c.get("services").mcpTokenService.revoke(Number(c.req.param("id")));
  return c.json({ ok: true });
});
