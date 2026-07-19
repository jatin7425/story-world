export interface ILikesRepository {
  countForChapter(chapterId: number): Promise<number>;
  countForUser(userId: number): Promise<number>;
  isLikedBy(userId: number, chapterId: number): Promise<boolean>;
  like(userId: number, chapterId: number): Promise<void>;
  unlike(userId: number, chapterId: number): Promise<void>;
  deleteForChapters(chapterIds: number[]): Promise<void>;
}

export class LikesRepository implements ILikesRepository {
  constructor(private readonly db: D1Database) {}

  async countForChapter(chapterId: number): Promise<number> {
    const row = await this.db
      .prepare("SELECT COUNT(*) as count FROM likes WHERE chapter_id = ?")
      .bind(chapterId)
      .first<{ count: number }>();
    return row?.count ?? 0;
  }

  async countForUser(userId: number): Promise<number> {
    const row = await this.db
      .prepare("SELECT COUNT(*) as count FROM likes WHERE user_id = ?")
      .bind(userId)
      .first<{ count: number }>();
    return row?.count ?? 0;
  }

  async isLikedBy(userId: number, chapterId: number): Promise<boolean> {
    const row = await this.db
      .prepare("SELECT 1 FROM likes WHERE user_id = ? AND chapter_id = ?")
      .bind(userId, chapterId)
      .first();
    return !!row;
  }

  async like(userId: number, chapterId: number): Promise<void> {
    await this.db.prepare("INSERT OR IGNORE INTO likes (user_id, chapter_id) VALUES (?, ?)").bind(userId, chapterId).run();
  }

  async unlike(userId: number, chapterId: number): Promise<void> {
    await this.db.prepare("DELETE FROM likes WHERE user_id = ? AND chapter_id = ?").bind(userId, chapterId).run();
  }

  async deleteForChapters(chapterIds: number[]): Promise<void> {
    if (chapterIds.length === 0) return;
    const placeholders = chapterIds.map(() => "?").join(", ");
    await this.db.prepare(`DELETE FROM likes WHERE chapter_id IN (${placeholders})`).bind(...chapterIds).run();
  }
}
