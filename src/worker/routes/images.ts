import { Hono } from "hono";
import type { AppEnv } from "../hono-env";

export const imagesRoutes = new Hono<AppEnv>();

imagesRoutes.get("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) return c.text("Not found", 404);

  const image = await c.get("services").imagesRepository.findById(id);
  if (!image) return c.text("Not found", 404);

  const dataBase64 = image.data_base64 ?? "";
  try {
    const binaryString = typeof globalThis.atob === "function" ? globalThis.atob(dataBase64) : Buffer.from(dataBase64, "base64").toString("binary");
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
    return new Response(bytes, { headers: { "Content-Type": image.content_type ?? "application/octet-stream" } });
  } catch (err) {
    return c.text("Failed to decode image", 500);
  }
});
