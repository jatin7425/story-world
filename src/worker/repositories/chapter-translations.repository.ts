import type { ChapterTranslationRow, ChapterContentFormat } from "./types";

export interface IChapterTranslationsRepository {
  find(chapterId: number, lang: string): Promise<ChapterTranslationRow | null>;
  upsert(
    chapterId: number,
    lang: string,
    title: string | null,
    content: string,
    contentFormat: ChapterContentFormat
  ): Promise<ChapterTranslationRow>;
  deleteForChapter(chapterId: number): Promise<void>;
  deleteForChapters(chapterIds: number[]): Promise<void>;
  deleteOne(chapterId: number, lang: string): Promise<void>;
}

export class ChapterTranslationsRepository implements IChapterTranslationsRepository {
  constructor(private readonly db: D1Database) {}

  async find(chapterId: number, lang: string): Promise<ChapterTranslationRow | null> {
    const row = await this.db
      .prepare(
        "SELECT id, chapter_id, lang, title, content, content_format, created_at FROM chapter_translations WHERE chapter_id = ? AND lang = ?"
      )
      .bind(chapterId, lang)
      .first<ChapterTranslationRow>();
    return row ?? null;
  }

  async upsert(
    chapterId: number,
    lang: string,
    title: string | null,
    content: string,
    contentFormat: ChapterContentFormat
  ): Promise<ChapterTranslationRow> {
    const row = await this.db
      .prepare(
        `INSERT INTO chapter_translations (chapter_id, lang, title, content, content_format)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(chapter_id, lang) DO UPDATE SET title = excluded.title, content = excluded.content, content_format = excluded.content_format, created_at = CURRENT_TIMESTAMP
         RETURNING id, chapter_id, lang, title, content, content_format, created_at`
      )
      .bind(chapterId, lang, title, content, contentFormat)
      .first<ChapterTranslationRow>();
    return row!;
  }

  async deleteForChapter(chapterId: number): Promise<void> {
    await this.db.prepare("DELETE FROM chapter_translations WHERE chapter_id = ?").bind(chapterId).run();
  }

  async deleteForChapters(chapterIds: number[]): Promise<void> {
    if (chapterIds.length === 0) return;
    const placeholders = chapterIds.map(() => "?").join(",");
    await this.db.prepare(`DELETE FROM chapter_translations WHERE chapter_id IN (${placeholders})`).bind(...chapterIds).run();
  }

  async deleteOne(chapterId: number, lang: string): Promise<void> {
    await this.db.prepare("DELETE FROM chapter_translations WHERE chapter_id = ? AND lang = ?").bind(chapterId, lang).run();
  }
}
