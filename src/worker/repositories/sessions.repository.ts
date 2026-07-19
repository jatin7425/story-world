import type { AuthUser } from "../types";
import { toAuthUser, type AuthUserRow } from "../lib/avatar";

export interface ISessionsRepository {
  create(token: string, userId: number, expiresAt: string): Promise<void>;
  findActiveUserByToken(token: string): Promise<AuthUser | null>;
  deleteAllForUser(userId: number): Promise<void>;
}

export class SessionsRepository implements ISessionsRepository {
  constructor(private readonly db: D1Database) {}

  async create(token: string, userId: number, expiresAt: string): Promise<void> {
    await this.db
      .prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)")
      .bind(token, userId, expiresAt)
      .run();
  }

  async findActiveUserByToken(token: string): Promise<AuthUser | null> {
    const row = await this.db
      .prepare(
        `SELECT u.id, u.email, u.username, u.display_name, u.role, u.gender, u.avatar_gender, u.avatar_seed, u.birthdate
         FROM sessions s JOIN users u ON u.id = s.user_id
         WHERE s.token = ? AND s.expires_at > CURRENT_TIMESTAMP`
      )
      .bind(token)
      .first<AuthUserRow>();
    return row ? toAuthUser(row) : null;
  }

  async deleteAllForUser(userId: number): Promise<void> {
    await this.db.prepare("DELETE FROM sessions WHERE user_id = ?").bind(userId).run();
  }
}
