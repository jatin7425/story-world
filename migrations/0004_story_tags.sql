-- Free-text tags/categories for a story (comma-separated, admin-set), used
-- for browsing and as an extra field the search endpoint matches against.
ALTER TABLE stories ADD COLUMN tags TEXT;
