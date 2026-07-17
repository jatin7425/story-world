export type RestrictionType = "banned" | "comment" | "react";

export interface IRestrictionsRepository {
  listForUser(userId: number): Promise<RestrictionType[]>;
  listForUsers(userIds: number[]): Promise<Map<number, RestrictionType[]>>;
  has(userId: number, restriction: RestrictionType): Promise<boolean>;
  add(userId: number, restriction: RestrictionType): Promise<void>;
  remove(userId: number, restriction: RestrictionType): Promise<void>;
}

export class RestrictionsRepository implements IRestrictionsRepository {
  constructor(private readonly db: D1Database) {}

  async listForUser(userId: number): Promise<RestrictionType[]> {
    const { results } = await this.db
      .prepare("SELECT restriction FROM user_restrictions WHERE user_id = ?")
      .bind(userId)
      .all<{ restriction: RestrictionType }>();
    return results.map((r) => r.restriction);
  }

  async listForUsers(userIds: number[]): Promise<Map<number, RestrictionType[]>> {
    const map = new Map<number, RestrictionType[]>();
    if (userIds.length === 0) return map;

    const placeholders = userIds.map(() => "?").join(", ");
    const { results } = await this.db
      .prepare(`SELECT user_id, restriction FROM user_restrictions WHERE user_id IN (${placeholders})`)
      .bind(...userIds)
      .all<{ user_id: number; restriction: RestrictionType }>();

    for (const row of results) {
      const list = map.get(row.user_id) ?? [];
      list.push(row.restriction);
      map.set(row.user_id, list);
    }
    return map;
  }

  async has(userId: number, restriction: RestrictionType): Promise<boolean> {
    const row = await this.db
      .prepare("SELECT 1 FROM user_restrictions WHERE user_id = ? AND restriction = ?")
      .bind(userId, restriction)
      .first();
    return !!row;
  }

  async add(userId: number, restriction: RestrictionType): Promise<void> {
    await this.db
      .prepare("INSERT OR IGNORE INTO user_restrictions (user_id, restriction) VALUES (?, ?)")
      .bind(userId, restriction)
      .run();
  }

  async remove(userId: number, restriction: RestrictionType): Promise<void> {
    await this.db
      .prepare("DELETE FROM user_restrictions WHERE user_id = ? AND restriction = ?")
      .bind(userId, restriction)
      .run();
  }
}
