import { Hono } from "hono";
import type { AppEnv } from "../hono-env";
import { suggestLangForCountry } from "../lib/locale";

export const localeRoutes = new Hono<AppEnv>();

// No auth, no DB call — cheap enough to call once on every frontend boot.
// `cf` is undefined in local dev (Miniflare doesn't populate it), which
// suggestLangForCountry already treats the same as "no country data": "en".
localeRoutes.get("/locale", (c) => {
  const country = c.req.raw.cf?.country ?? null;
  const suggestedLang = suggestLangForCountry(typeof country === "string" ? country : null);
  return c.json({ suggestedLang, country: typeof country === "string" ? country : null });
});
