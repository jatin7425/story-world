import type { CommentRow, ProfileCommentRow } from "./types";

export interface CommentPage {
  items: CommentRow[];
  total: number;
}

export interface ProfileCommentPage {
  items: ProfileCommentRow[];
  total: number;
}

export interface ICommentsRepository {
  listForChapter(chapterId: number, limit: number, offset: number): Promise<CommentPage>;
  create(chapterId: number, userId: number, body: string): Promise<Pick<CommentRow, "id" | "body" | "created_at">>;
  listRecentForUser(userId: number, limit: number, offset: number): Promise<ProfileCommentPage>;
  deleteForChapters(chapterIds: number[]): Promise<void>;
}

export class CommentsRepository implements ICommentsRepository {
  constructor(private readonly db: D1Database) {}

  async listForChapter(chapterId: number, limit: number, offset: number): Promise<CommentPage> {
    const [{ results }, countRow] = await Promise.all([
      this.db
        .prepare(
          `SELECT c.id, c.body, c.created_at, u.display_name, u.email
           FROM comments c JOIN users u ON u.id = c.user_id
           WHERE c.chapter_id = ? ORDER BY c.created_at ASC LIMIT ? OFFSET ?`
        )
        .bind(chapterId, limit, offset)
        .all<CommentRow>(),
      this.db.prepare("SELECT COUNT(*) as count FROM comments WHERE chapter_id = ?").bind(chapterId).first<{ count: number }>(),
    ]);
    return { items: results, total: countRow?.count ?? 0 };
  }

  async create(chapterId: number, userId: number, body: string): Promise<Pick<CommentRow, "id" | "body" | "created_at">> {
    const row = await this.db
      .prepare("INSERT INTO comments (chapter_id, user_id, body) VALUES (?, ?, ?) RETURNING id, body, created_at")
      .bind(chapterId, userId, body)
      .first<Pick<CommentRow, "id" | "body" | "created_at">>();
    return row!;
  }

  async listRecentForUser(userId: number, limit: number, offset: number): Promise<ProfileCommentPage> {
    const [{ results }, countRow] = await Promise.all([
      this.db
        .prepare(
          `SELECT c.id, c.body, c.created_at, ch.chapter_number, s.title as story_title, s.slug as story_slug
           FROM comments c
           JOIN chapters ch ON ch.id = c.chapter_id
           JOIN stories s ON s.id = ch.story_id
           WHERE c.user_id = ? ORDER BY c.created_at DESC LIMIT ? OFFSET ?`
        )
        .bind(userId, limit, offset)
        .all<ProfileCommentRow>(),
      this.db.prepare("SELECT COUNT(*) as count FROM comments WHERE user_id = ?").bind(userId).first<{ count: number }>(),
    ]);
    return { items: results, total: countRow?.count ?? 0 };
  }

  async deleteForChapters(chapterIds: number[]): Promise<void> {
    if (chapterIds.length === 0) return;
    const placeholders = chapterIds.map(() => "?").join(", ");
    await this.db.prepare(`DELETE FROM comments WHERE chapter_id IN (${placeholders})`).bind(...chapterIds).run();
  }
}
