-- Translation is back to being cached (Gemini-only now, see
-- lib/translate.ts), but at per-segment granularity to match the
-- paragraph-by-paragraph live-reveal reader UX: each paragraph is cached
-- independently the first time any reader triggers it, so a later reader
-- (or the same one reloading) gets that paragraph instantly instead of
-- re-calling Gemini. segment_index = -1 is the chapter title.
CREATE TABLE story_translations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  story_id INTEGER NOT NULL REFERENCES stories(id),
  lang TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  UNIQUE (story_id, lang)
);

CREATE TABLE chapter_segment_translations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chapter_id INTEGER NOT NULL REFERENCES chapters(id),
  lang TEXT NOT NULL,
  segment_index INTEGER NOT NULL,
  text TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  UNIQUE (chapter_id, lang, segment_index)
);
CREATE INDEX idx_chapter_segment_translations_lookup ON chapter_segment_translations(chapter_id, lang);
