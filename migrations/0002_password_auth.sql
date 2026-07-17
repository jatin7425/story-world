-- Adds optional password-based login alongside the existing magic-link flow.
-- password_hash is NULL for accounts that have only ever used magic links.
ALTER TABLE users ADD COLUMN password_hash TEXT;
ALTER TABLE users ADD COLUMN username TEXT;
ALTER TABLE users ADD COLUMN mobile TEXT;

CREATE UNIQUE INDEX idx_users_username ON users(username) WHERE username IS NOT NULL;
