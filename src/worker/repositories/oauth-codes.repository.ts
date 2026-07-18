import type { OAuthAuthorizationCodeRow } from "./types";

export interface CreateAuthorizationCodeInput {
  code: string;
  clientId: string;
  userId: number;
  redirectUri: string;
  codeChallenge: string;
  scope: string | null;
  expiresAt: string;
}

export interface IOAuthCodesRepository {
  create(input: CreateAuthorizationCodeInput): Promise<OAuthAuthorizationCodeRow>;
  findByCode(code: string): Promise<OAuthAuthorizationCodeRow | null>;
  markUsed(code: string): Promise<void>;
}

export class OAuthCodesRepository implements IOAuthCodesRepository {
  constructor(private readonly db: D1Database) {}

  async create(input: CreateAuthorizationCodeInput): Promise<OAuthAuthorizationCodeRow> {
    const row = await this.db
      .prepare(
        `INSERT INTO oauth_authorization_codes (code, client_id, user_id, redirect_uri, code_challenge, scope, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         RETURNING code, client_id, user_id, redirect_uri, code_challenge, scope, expires_at, used_at`
      )
      .bind(input.code, input.clientId, input.userId, input.redirectUri, input.codeChallenge, input.scope, input.expiresAt)
      .first<OAuthAuthorizationCodeRow>();
    return row!;
  }

  async findByCode(code: string): Promise<OAuthAuthorizationCodeRow | null> {
    const row = await this.db
      .prepare(
        `SELECT code, client_id, user_id, redirect_uri, code_challenge, scope, expires_at, used_at
         FROM oauth_authorization_codes WHERE code = ?`
      )
      .bind(code)
      .first<OAuthAuthorizationCodeRow>();
    return row ?? null;
  }

  async markUsed(code: string): Promise<void> {
    await this.db
      .prepare("UPDATE oauth_authorization_codes SET used_at = CURRENT_TIMESTAMP WHERE code = ?")
      .bind(code)
      .run();
  }
}
