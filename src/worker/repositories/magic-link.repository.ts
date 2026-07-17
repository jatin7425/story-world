export interface IMagicLinkRepository {
  create(token: string, email: string, expiresAt: string): Promise<void>;
  consume(token: string): Promise<string | null>;
}

export class MagicLinkRepository implements IMagicLinkRepository {
  constructor(private readonly db: D1Database) {}

  async create(token: string, email: string, expiresAt: string): Promise<void> {
    await this.db
      .prepare("INSERT INTO magic_link_tokens (token, email, expires_at) VALUES (?, ?, ?)")
      .bind(token, email, expiresAt)
      .run();
  }

  /** Returns the associated email and marks the token used, or null if invalid/expired/already used. */
  async consume(token: string): Promise<string | null> {
    const row = await this.db
      .prepare("SELECT email, expires_at, used_at FROM magic_link_tokens WHERE token = ?")
      .bind(token)
      .first<{ email: string; expires_at: string; used_at: string | null }>();

    if (!row || row.used_at) return null;
    if (new Date(row.expires_at).getTime() < Date.now()) return null;

    await this.db.prepare("UPDATE magic_link_tokens SET used_at = CURRENT_TIMESTAMP WHERE token = ?").bind(token).run();
    return row.email;
  }
}
