-- Chapters written with the new rich-text editor store real (sanitized)
-- HTML instead of the hand-rolled markdown-ish syntax. This flag lets the
-- renderer pick the right parser per chapter; existing/MCP-authored rows
-- default to 'markdown' and keep rendering exactly as before.
ALTER TABLE chapters ADD COLUMN content_format TEXT NOT NULL DEFAULT 'markdown';
