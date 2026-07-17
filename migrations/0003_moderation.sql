-- Generic per-user restriction flags. A row's presence means the restriction
-- is active; deleting the row lifts it. Kept as its own table (rather than
-- boolean columns on users) so new restriction types don't need a migration.
-- 'banned'  — blocks login entirely (all sessions are also revoked on ban)
-- 'comment' — blocks posting new comments
-- 'react'   — blocks liking chapters
CREATE TABLE user_restrictions (
  user_id INTEGER NOT NULL REFERENCES users(id),
  restriction TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  PRIMARY KEY (user_id, restriction)
);

CREATE INDEX idx_user_restrictions_user ON user_restrictions(user_id);
