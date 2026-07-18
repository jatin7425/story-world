-- Admin-triggered translation jobs. Readers never trigger a live translation
-- themselves (see TranslationService, which only ever reads the cache tables
-- from 0012); a job here is the only thing that ever calls out to a
-- provider. The client drives progress by repeatedly stepping the job one
-- item at a time (see TranslationJobService.stepJob) rather than relying on
-- a long-running background task, so there's no dependency on Workers'
-- execution-time limits regardless of how many items or how slow a provider
-- is.
CREATE TABLE translation_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_by INTEGER NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'running', -- 'running' | 'completed' | 'failed'
  total_items INTEGER NOT NULL,
  completed_items INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE TABLE translation_job_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER NOT NULL REFERENCES translation_jobs(id),
  entity_type TEXT NOT NULL, -- 'story' | 'chapter'
  entity_id INTEGER NOT NULL,
  entity_label TEXT NOT NULL, -- denormalized display text, e.g. "Chapter 3: The Weight of Saving People"
  lang TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'running' | 'done' | 'failed'
  provider_used TEXT, -- 'workers-ai' | 'groq' | 'gemini' | 'aion' | 'cache'
  log TEXT NOT NULL DEFAULT '', -- newline-joined attempt trail
  error_message TEXT
);

CREATE INDEX idx_translation_job_items_job ON translation_job_items(job_id);
