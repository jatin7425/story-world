-- Reader-chosen language preferences, collected at signup. 'en' | 'hi' | 'ja'
-- | 'ko', both nullable (no preference set = fall back to the location-based
-- suggestion, see routes/locale.ts).
ALTER TABLE users ADD COLUMN preferred_lang TEXT;
ALTER TABLE users ADD COLUMN secondary_lang TEXT;
