-- Denormalized, comma-separated cache of which languages currently have a
-- valid cached translation for this entity (e.g. "en,hi,ja"), so the
-- frontend can pick a language to request without querying the translation
-- tables directly. Kept in sync by TranslationJobService (append on a
-- successful translation) and the same invalidation hooks that clear
-- story_translations/chapter_translations rows (reset to 'en' on any content
-- edit).
ALTER TABLE stories ADD COLUMN lang TEXT NOT NULL DEFAULT 'en';
ALTER TABLE chapters ADD COLUMN lang TEXT NOT NULL DEFAULT 'en';
