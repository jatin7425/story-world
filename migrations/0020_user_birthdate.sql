-- Self-declared age verification: users state their birthdate once (no
-- document upload). Used to gate access to stories rated 13+/16+/18+.
-- age_verified_at records when the declaration was made.
ALTER TABLE users ADD COLUMN birthdate TEXT;
ALTER TABLE users ADD COLUMN age_verified_at TEXT;
