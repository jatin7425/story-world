-- Per-chapter draft/published gate, independent of the parent story's own
-- status. Existing behavior (admin-added chapters go live immediately) is
-- preserved via the default; only MCP-created content is forced into
-- 'draft' at creation time by application code.
ALTER TABLE chapters ADD COLUMN status TEXT NOT NULL DEFAULT 'published';
CREATE INDEX idx_chapters_status ON chapters(status);

-- Tracks whether a story was created by an admin or by an MCP tool call,
-- for display/audit in the admin panel. Deliberately separate from
-- is_ai_generated, which drives the *existing* Workers AI daily-cron
-- generation — MCP stories must never be picked up by that cron, so they
-- keep is_ai_generated = 0.
ALTER TABLE stories ADD COLUMN created_via TEXT NOT NULL DEFAULT 'admin';

-- Bearer tokens for the MCP endpoint. Only a hash is stored — the raw
-- token is shown to the admin once, at creation, like a GitHub PAT.
CREATE TABLE mcp_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  last_used_at TEXT,
  revoked_at TEXT
);
CREATE INDEX idx_mcp_tokens_hash ON mcp_tokens(token_hash);
