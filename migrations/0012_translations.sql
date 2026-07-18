-- Cached LLM-generated translations of story descriptions/chapter content.
-- One row per (entity, language). Invalidation is delete-on-mutation, not
-- compare-on-read: any content edit deletes the relevant row(s) synchronously
-- (see AdminStoryService/McpToolsService), so a present row is always fresh.
CREATE TABLE story_translations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  story_id INTEGER NOT NULL REFERENCES stories(id),
  lang TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  UNIQUE (story_id, lang)
);

CREATE TABLE chapter_translations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chapter_id INTEGER NOT NULL REFERENCES chapters(id),
  lang TEXT NOT NULL,
  title TEXT,
  content TEXT NOT NULL,
  content_format TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  UNIQUE (chapter_id, lang)
);
