-- Translation moved from an admin-triggered, cached, 3-language LLM pipeline
-- to live on-demand translation via the free Google Translate endpoint for
-- any language it supports (see lib/google-translate.ts) — there is nothing
-- left to cache or track job progress for, so this drops the whole
-- now-unused subsystem.
DROP TABLE IF EXISTS chapter_translations;
DROP TABLE IF EXISTS story_translations;
DROP TABLE IF EXISTS translation_job_items;
DROP TABLE IF EXISTS translation_jobs;

ALTER TABLE stories DROP COLUMN lang;
ALTER TABLE chapters DROP COLUMN lang;
