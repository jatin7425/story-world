import { Hono } from "hono";
import type { AppEnv } from "../hono-env";
import { adminGuard } from "../lib/admin-guard";
import type { RestrictionType } from "../repositories/restrictions.repository";
import { parseAdminPagination } from "../lib/pagination";

export const adminUsersRoutes = new Hono<AppEnv>();
adminUsersRoutes.use("*", adminGuard);

const VALID_RESTRICTIONS: RestrictionType[] = ["banned", "comment", "react"];

function parseRestriction(value: string): RestrictionType | null {
  return (VALID_RESTRICTIONS as string[]).includes(value) ? (value as RestrictionType) : null;
}

adminUsersRoutes.get("/users", async (c) => {
  const { page, limit } = parseAdminPagination(c);
  const { items, total, totalPages } = await c.get("services").adminUserService.listUsers(page, limit);
  return c.json({ users: items, total, page, limit, totalPages });
});

adminUsersRoutes.post("/users/:id/ban", async (c) => {
  const result = await c.get("services").adminUserService.ban(Number(c.req.param("id")));
  if ("error" in result) return c.json(result, 400);
  return c.json(result);
});

adminUsersRoutes.delete("/users/:id/ban", async (c) => {
  const result = await c.get("services").adminUserService.unban(Number(c.req.param("id")));
  return c.json(result);
});

adminUsersRoutes.put("/users/:id/restrictions/:type", async (c) => {
  const type = parseRestriction(c.req.param("type"));
  if (!type) return c.json({ error: "Unknown restriction type" }, 400);

  const result = await c.get("services").adminUserService.setRestriction(Number(c.req.param("id")), type, true);
  if ("error" in result) return c.json(result, 400);
  return c.json(result);
});

adminUsersRoutes.delete("/users/:id/restrictions/:type", async (c) => {
  const type = parseRestriction(c.req.param("type"));
  if (!type) return c.json({ error: "Unknown restriction type" }, 400);

  const result = await c.get("services").adminUserService.setRestriction(Number(c.req.param("id")), type, false);
  if ("error" in result) return c.json(result, 400);
  return c.json(result);
});
