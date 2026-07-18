import { Hono } from "hono";
import type { AppEnv } from "../hono-env";
import { adminGuard } from "../lib/admin-guard";

export const adminImagesRoutes = new Hono<AppEnv>();
adminImagesRoutes.use("*", adminGuard);

adminImagesRoutes.get("/images", async (c) => {
  const page = Number(c.req.query("page") ?? 1);
  const limit = Number(c.req.query("limit") ?? 50);
  const offset = (page - 1) * limit;
  const { items, total } = await c.get("services").imagesRepository.list(limit, offset);
  return c.json({ images: items, total, page, limit, totalPages: Math.ceil(total / limit) });
});

adminImagesRoutes.post("/images", async (c) => {
  const contentType = c.req.header("Content-Type") ?? "";
  let filename: string | null = null;
  let content_type: string | null = null;
  let data_base64: string | null = null;
  let source_url: string | null = null;

  if (contentType.startsWith("multipart/form-data")) {
    // Parse uploaded file
    const form = await c.req.raw.formData();
    const file = form.get("file") as File | null;
    source_url = (form.get("source_url") as string) ?? null;
    if (file instanceof File) {
      filename = file.name;
      content_type = file.type || null;
      const buf = await file.arrayBuffer();
      let binary = "";
      const bytes = new Uint8Array(buf);
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      data_base64 = typeof globalThis.btoa === "function" ? globalThis.btoa(binary) : Buffer.from(binary, "binary").toString("base64");
    }
  } else {
    const body = await c.req.json<{ data_base64?: string; source_url?: string; filename?: string; content_type?: string }>();
    data_base64 = body.data_base64 ?? null;
    source_url = body.source_url ?? null;
    filename = body.filename ?? null;
    content_type = body.content_type ?? null;
  }

  if (!data_base64 && !source_url) return c.json({ error: "Either data_base64 or source_url is required." }, 400);

  const row = await c.get("services").imagesRepository.create(filename ?? null, content_type ?? null, data_base64 ?? null, source_url ?? null);
  return c.json({ image: row });
});

adminImagesRoutes.delete("/images/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) return c.json({ error: "Invalid id" }, 400);
  await c.get("services").imagesRepository.delete(id);
  return c.json({ ok: true });
});
