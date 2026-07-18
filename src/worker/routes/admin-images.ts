import { Hono } from "hono";
import type { AppEnv } from "../hono-env";
import { adminGuard } from "../lib/admin-guard";

export const adminImagesRoutes = new Hono<AppEnv>();
adminImagesRoutes.use("*", adminGuard);

// D1 rejects a single column value beyond ~1MB (SQLITE_TOOBIG) — images are
// stored base64-inline here (~4/3 size inflation), so cap raw bytes well
// under that, with headroom for the rest of the row. A real object-storage
// backend (R2) would remove this ceiling entirely; this is the stopgap that
// turns an unhandled D1 crash into a clean, user-facing error instead.
const MAX_IMAGE_BYTES = 500_000;

adminImagesRoutes.get("/images", async (c) => {
  const page = Number(c.req.query("page") ?? 1);
  const limit = Number(c.req.query("limit") ?? 50);
  const offset = (page - 1) * limit;
  const { items, total } = await c.get("services").imagesRepository.list(limit, offset);

  // Strip data_base64 — the list view only ever needs it for the <img> tag,
  // which loads it separately from GET /images/:id. Sending the full blob
  // for every row here made this response scale with total image bytes
  // instead of just row count.
  const images = items.map(({ data_base64: _dataBase64, ...rest }) => rest);
  return c.json({ images, total, page, limit, totalPages: Math.ceil(total / limit) });
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
      if (file.size > MAX_IMAGE_BYTES) {
        return c.json(
          { error: `Image is ${(file.size / 1_000_000).toFixed(1)}MB — please use a file under ${MAX_IMAGE_BYTES / 1_000_000}MB.` },
          400
        );
      }
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

  // A bare source_url previously got stored as-is with no bytes fetched at
  // all — the record existed but /images/:id served an empty 200 response.
  // Actually fetch and inline it, same as a direct file upload.
  if (!data_base64 && source_url) {
    let upstream: Response;
    try {
      upstream = await fetch(source_url);
    } catch {
      return c.json({ error: `Could not reach ${source_url}` }, 400);
    }
    if (!upstream.ok) return c.json({ error: `Fetching ${source_url} failed: ${upstream.status}` }, 400);

    const declaredLength = Number(upstream.headers.get("content-length"));
    if (declaredLength && declaredLength > MAX_IMAGE_BYTES) {
      return c.json(
        { error: `That image is ${(declaredLength / 1_000_000).toFixed(1)}MB — please use one under ${MAX_IMAGE_BYTES / 1_000_000}MB.` },
        400
      );
    }

    const buf = await upstream.arrayBuffer();
    if (buf.byteLength > MAX_IMAGE_BYTES) {
      return c.json(
        { error: `That image is ${(buf.byteLength / 1_000_000).toFixed(1)}MB — please use one under ${MAX_IMAGE_BYTES / 1_000_000}MB.` },
        400
      );
    }

    let binary = "";
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    data_base64 = globalThis.btoa(binary);
    content_type = content_type ?? upstream.headers.get("content-type");
    filename = filename ?? source_url.split("/").pop()?.split("?")[0] ?? null;
  }

  // The checks above are a fast pre-check (reject oversized uploads before
  // spending time downloading/re-encoding them); ImagesRepository.create()
  // is the authoritative check that actually protects every caller,
  // including the MCP upload tools which call it directly.
  try {
    const row = await c
      .get("services")
      .imagesRepository.create(filename ?? null, content_type ?? null, data_base64 ?? null, source_url ?? null);
    return c.json({ image: row });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "Failed to save image" }, 400);
  }
});

adminImagesRoutes.delete("/images/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) return c.json({ error: "Invalid id" }, 400);
  await c.get("services").imagesRepository.delete(id);
  return c.json({ ok: true });
});
