-- Optional per-chapter illustration/label image. URL only (no upload
-- pipeline) — an MCP-connected image-generation tool is expected to host
-- the image itself and hand back a URL, same contract as stories.cover_image_url.
ALTER TABLE chapters ADD COLUMN image_url TEXT;
