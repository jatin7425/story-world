import type { OAuthAccessTokenRow, OAuthRefreshTokenRow } from "./types";

export interface IOAuthTokensRepository {
  createAccessToken(tokenHash: string, clientId: string, userId: number, expiresAt: string): Promise<void>;
  findValidAccessToken(tokenHash: string): Promise<OAuthAccessTokenRow | null>;
  touchAccessTokenLastUsed(tokenHash: string): Promise<void>;

  createRefreshToken(tokenHash: string, clientId: string, userId: number, expiresAt: string): Promise<void>;
  findValidRefreshToken(tokenHash: string): Promise<OAuthRefreshTokenRow | null>;
  revokeRefreshToken(tokenHash: string): Promise<void>;
}

export class OAuthTokensRepository implements IOAuthTokensRepository {
  constructor(private readonly db: D1Database) {}

  async createAccessToken(tokenHash: string, clientId: string, userId: number, expiresAt: string): Promise<void> {
    await this.db
      .prepare("INSERT INTO oauth_access_tokens (token_hash, client_id, user_id, expires_at) VALUES (?, ?, ?, ?)")
      .bind(tokenHash, clientId, userId, expiresAt)
      .run();
  }

  async findValidAccessToken(tokenHash: string): Promise<OAuthAccessTokenRow | null> {
    const row = await this.db
      .prepare(
        `SELECT token_hash, client_id, user_id, expires_at, created_at, last_used_at
         FROM oauth_access_tokens WHERE token_hash = ? AND expires_at > CURRENT_TIMESTAMP`
      )
      .bind(tokenHash)
      .first<OAuthAccessTokenRow>();
    return row ?? null;
  }

  async touchAccessTokenLastUsed(tokenHash: string): Promise<void> {
    await this.db
      .prepare("UPDATE oauth_access_tokens SET last_used_at = CURRENT_TIMESTAMP WHERE token_hash = ?")
      .bind(tokenHash)
      .run();
  }

  async createRefreshToken(tokenHash: string, clientId: string, userId: number, expiresAt: string): Promise<void> {
    await this.db
      .prepare("INSERT INTO oauth_refresh_tokens (token_hash, client_id, user_id, expires_at) VALUES (?, ?, ?, ?)")
      .bind(tokenHash, clientId, userId, expiresAt)
      .run();
  }

  async findValidRefreshToken(tokenHash: string): Promise<OAuthRefreshTokenRow | null> {
    const row = await this.db
      .prepare(
        `SELECT token_hash, client_id, user_id, expires_at, created_at, revoked_at
         FROM oauth_refresh_tokens WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > CURRENT_TIMESTAMP`
      )
      .bind(tokenHash)
      .first<OAuthRefreshTokenRow>();
    return row ?? null;
  }

  async revokeRefreshToken(tokenHash: string): Promise<void> {
    await this.db
      .prepare("UPDATE oauth_refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE token_hash = ?")
      .bind(tokenHash)
      .run();
  }
}
