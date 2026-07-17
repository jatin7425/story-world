import type { McpTokenRow } from "./types";

export interface McpTokenPage {
  items: McpTokenRow[];
  total: number;
}

export interface IMcpTokensRepository {
  create(name: string, tokenHash: string, createdBy: number): Promise<McpTokenRow>;
  listActive(limit: number, offset: number): Promise<McpTokenPage>;
  findActiveByHash(tokenHash: string): Promise<McpTokenRow | null>;
  touchLastUsed(id: number): Promise<void>;
  revoke(id: number): Promise<void>;
}

export class McpTokensRepository implements IMcpTokensRepository {
  constructor(private readonly db: D1Database) {}

  async create(name: string, tokenHash: string, createdBy: number): Promise<McpTokenRow> {
    const row = await this.db
      .prepare(
        `INSERT INTO mcp_tokens (name, token_hash, created_by)
         VALUES (?, ?, ?)
         RETURNING id, name, token_hash, created_by, created_at, last_used_at, revoked_at`
      )
      .bind(name, tokenHash, createdBy)
      .first<McpTokenRow>();
    return row!;
  }

  async listActive(limit: number, offset: number): Promise<McpTokenPage> {
    const [{ results }, countRow] = await Promise.all([
      this.db
        .prepare(
          `SELECT id, name, token_hash, created_by, created_at, last_used_at, revoked_at
           FROM mcp_tokens WHERE revoked_at IS NULL ORDER BY created_at DESC LIMIT ? OFFSET ?`
        )
        .bind(limit, offset)
        .all<McpTokenRow>(),
      this.db.prepare("SELECT COUNT(*) as count FROM mcp_tokens WHERE revoked_at IS NULL").first<{ count: number }>(),
    ]);
    return { items: results, total: countRow?.count ?? 0 };
  }

  async findActiveByHash(tokenHash: string): Promise<McpTokenRow | null> {
    const row = await this.db
      .prepare(
        `SELECT id, name, token_hash, created_by, created_at, last_used_at, revoked_at
         FROM mcp_tokens WHERE token_hash = ? AND revoked_at IS NULL`
      )
      .bind(tokenHash)
      .first<McpTokenRow>();
    return row ?? null;
  }

  async touchLastUsed(id: number): Promise<void> {
    await this.db.prepare("UPDATE mcp_tokens SET last_used_at = CURRENT_TIMESTAMP WHERE id = ?").bind(id).run();
  }

  async revoke(id: number): Promise<void> {
    await this.db.prepare("UPDATE mcp_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE id = ?").bind(id).run();
  }
}
