import type { IMcpTokensRepository } from "../repositories/mcp-tokens.repository";
import type { McpTokenRow } from "../repositories/types";
import { randomHex, sha256Hex } from "../lib/hash";

export interface McpTokenView {
  id: number;
  name: string;
  created_at: string;
  last_used_at: string | null;
}

/**
 * Admin-facing token lifecycle for the MCP endpoint, plus the verification
 * path the MCP route itself calls on every request. Raw tokens exist only
 * at generation time — everything at rest is a SHA-256 hash, same principle
 * as password storage.
 */
export class McpTokenService {
  constructor(private readonly tokens: IMcpTokensRepository) {}

  async generate(name: string, createdBy: number): Promise<{ token: string; record: McpTokenView }> {
    const raw = `mcp_${randomHex(32)}`;
    const hash = await sha256Hex(raw);
    const record = await this.tokens.create(name.trim() || "Unnamed token", hash, createdBy);
    return { token: raw, record: toView(record) };
  }

  async list(): Promise<McpTokenView[]> {
    const rows = await this.tokens.listActive();
    return rows.map(toView);
  }

  revoke(id: number): Promise<void> {
    return this.tokens.revoke(id);
  }

  /** Verifies a raw bearer token and marks it used. Returns true if valid and active. */
  async verify(rawToken: string): Promise<boolean> {
    const hash = await sha256Hex(rawToken);
    const record = await this.tokens.findActiveByHash(hash);
    if (!record) return false;
    await this.tokens.touchLastUsed(record.id);
    return true;
  }
}

function toView(row: McpTokenRow): McpTokenView {
  return { id: row.id, name: row.name, created_at: row.created_at, last_used_at: row.last_used_at };
}
