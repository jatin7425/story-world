-- Users: readers, admins, and (future) author-contributors are all rows here.
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT,
  role TEXT NOT NULL DEFAULT 'reader', -- 'reader' | 'author' | 'admin'
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

-- Magic-link login tokens (short-lived, single-use).
CREATE TABLE magic_link_tokens (
  token TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT
);

-- Sessions issued after a successful magic-link verification.
CREATE TABLE sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

-- Stories. author_id points at a user so reader-submitted stories (future)
-- fit the same table without a schema change. status supports a future
-- moderation queue (draft -> pending -> published).
CREATE TABLE stories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  cover_image_url TEXT,
  author_id INTEGER REFERENCES users(id), -- NULL = admin/house story
  status TEXT NOT NULL DEFAULT 'published', -- 'draft' | 'pending' | 'published'
  free_chapter_count INTEGER NOT NULL DEFAULT 3,
  is_ai_generated INTEGER NOT NULL DEFAULT 0, -- 1 if the daily cron writes chapters for this story
  ai_generation_prompt TEXT, -- seed/style prompt used by the cron job, if applicable
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE TABLE chapters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  story_id INTEGER NOT NULL REFERENCES stories(id),
  chapter_number INTEGER NOT NULL,
  title TEXT,
  content TEXT NOT NULL,
  generated_by TEXT NOT NULL DEFAULT 'admin', -- 'admin' | 'ai'
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  UNIQUE (story_id, chapter_number)
);

CREATE TABLE comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chapter_id INTEGER NOT NULL REFERENCES chapters(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE TABLE likes (
  user_id INTEGER NOT NULL REFERENCES users(id),
  chapter_id INTEGER NOT NULL REFERENCES chapters(id),
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  PRIMARY KEY (user_id, chapter_id)
);

CREATE TABLE follows (
  user_id INTEGER NOT NULL REFERENCES users(id),
  story_id INTEGER NOT NULL REFERENCES stories(id),
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  PRIMARY KEY (user_id, story_id)
);

CREATE INDEX idx_chapters_story ON chapters(story_id);
CREATE INDEX idx_comments_chapter ON comments(chapter_id);
CREATE INDEX idx_stories_status ON stories(status);
