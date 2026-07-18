-- Translation feature removed entirely (readers can use their browser's
-- built-in page-translate feature instead — no work needed on our side for
-- that). Only AI age-rating classification remains from that work; its
-- tables/columns (stories.age_rating etc., see 0017) are untouched.
DROP TABLE IF EXISTS chapter_segment_translations;
DROP TABLE IF EXISTS story_translations;

ALTER TABLE users DROP COLUMN preferred_lang;
ALTER TABLE users DROP COLUMN secondary_lang;
