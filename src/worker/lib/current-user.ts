import type { Context } from "hono";
import type { AppEnv } from "../hono-env";
import { readSessionCookie } from "./session-cookie";

export function getCurrentUser(c: Context<AppEnv>) {
  return c.get("services").authService.getCurrentUser(readSessionCookie(c));
}
