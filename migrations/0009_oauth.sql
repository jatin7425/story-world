-- OAuth 2.1 support for the MCP endpoint, alongside the existing static
-- bearer-token system (admin-generated tokens keep working for Desktop/Code
-- style clients that read a config file). This is for connector UIs (Claude
-- web, Grok, etc.) that only support OAuth — no field for a raw static
-- token. Public clients only: PKCE (S256), no client secret.

-- Dynamically registered clients (RFC 7591) — connector UIs auto-register
-- themselves rather than requiring a manually pre-configured Client ID.
CREATE TABLE oauth_clients (
  client_id TEXT PRIMARY KEY,
  client_name TEXT,
  redirect_uris TEXT NOT NULL, -- JSON array
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

-- Short-lived, single-use authorization codes issued once the admin
-- approves a connection on the consent screen; exchanged at /oauth/token.
CREATE TABLE oauth_authorization_codes (
  code TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES oauth_clients(client_id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  redirect_uri TEXT NOT NULL,
  code_challenge TEXT NOT NULL,
  scope TEXT,
  expires_at TEXT NOT NULL,
  used_at TEXT
);

-- Access tokens issued via the OAuth flow. Hashed at rest, same principle
-- as mcp_tokens — this table is functionally parallel to it, just reached
-- via OAuth instead of an admin-generated token.
CREATE TABLE oauth_access_tokens (
  token_hash TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES oauth_clients(client_id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  last_used_at TEXT
);

-- Refresh tokens, rotated on each use (old one revoked, new one issued)
-- so a stolen refresh token has a limited window of use.
CREATE TABLE oauth_refresh_tokens (
  token_hash TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES oauth_clients(client_id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  revoked_at TEXT
);

CREATE INDEX idx_oauth_codes_client ON oauth_authorization_codes(client_id);
CREATE INDEX idx_oauth_access_tokens_client ON oauth_access_tokens(client_id);
CREATE INDEX idx_oauth_refresh_tokens_client ON oauth_refresh_tokens(client_id);
