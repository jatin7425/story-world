import type { ChapterRow, ChapterSummaryRow, ChapterStatus, ChapterContentFormat } from "./types";

const CHAPTER_COLUMNS =
  "id, story_id, chapter_number, title, content, content_format, generated_by, status, image_url, created_at";
const CHAPTER_SUMMARY_COLUMNS = "id, chapter_number, title, status, generated_by, image_url, created_at";

export interface ChapterSummaryPage {
  items: ChapterSummaryRow[];
  total: number;
}

export interface CreateChapterInput {
  storyId: number;
  chapterNumber: number;
  title: string | null;
  content: string;
  contentFormat: ChapterContentFormat;
  generatedBy: "admin" | "ai" | "mcp";
  status: ChapterStatus;
  imageUrl: string | null;
}

export interface IChaptersRepository {
  /** All chapters incl. drafts, unpaginated — internal/cascade-delete use only. */
  listSummariesByStory(storyId: number): Promise<ChapterSummaryRow[]>;
  /** All chapters incl. drafts, paginated — admin UI. */
  listSummariesByStoryPaged(storyId: number, limit: number, offset: number): Promise<ChapterSummaryPage>;
  /** Published-only, paginated — safe for anything a reader or crawler can reach. */
  listPublishedSummariesByStory(storyId: number, limit: number, offset: number): Promise<ChapterSummaryPage>;
  /** Full rows (incl. content), all statuses, ascending order — MCP read tool use. */
  listFullByStory(storyId: number): Promise<ChapterRow[]>;
  findByStoryAndNumber(storyId: number, chapterNumber: number): Promise<ChapterRow | null>;
  /** Smallest *published* chapter_number greater than `afterNumber` — survives gaps left by deletion or still-draft chapters. */
  findNextChapterNumber(storyId: number, afterNumber: number): Promise<number | null>;
  maxChapterNumber(storyId: number): Promise<number>;
  create(input: CreateChapterInput): Promise<ChapterRow>;
  updateContent(
    storyId: number,
    chapterNumber: number,
    title: string | null,
    content: string,
    contentFormat: ChapterContentFormat,
    imageUrl: string | null
  ): Promise<ChapterRow | null>;
  updateStatus(storyId: number, chapterNumber: number, status: ChapterStatus): Promise<ChapterRow | null>;
  deleteByStoryAndNumber(storyId: number, chapterNumber: number): Promise<void>;
  deleteAllForStory(storyId: number): Promise<void>;
}

export class ChaptersRepository implements IChaptersRepository {
  constructor(private readonly db: D1Database) {}

  async listSummariesByStory(storyId: number): Promise<ChapterSummaryRow[]> {
    const { results } = await this.db
      .prepare(`SELECT ${CHAPTER_SUMMARY_COLUMNS} FROM chapters WHERE story_id = ? ORDER BY chapter_number ASC`)
      .bind(storyId)
      .all<ChapterSummaryRow>();
    return results;
  }

  async listSummariesByStoryPaged(storyId: number, limit: number, offset: number): Promise<ChapterSummaryPage> {
    const [{ results }, countRow] = await Promise.all([
      this.db
        .prepare(
          `SELECT ${CHAPTER_SUMMARY_COLUMNS} FROM chapters WHERE story_id = ? ORDER BY chapter_number ASC LIMIT ? OFFSET ?`
        )
        .bind(storyId, limit, offset)
        .all<ChapterSummaryRow>(),
      this.db.prepare("SELECT COUNT(*) as count FROM chapters WHERE story_id = ?").bind(storyId).first<{ count: number }>(),
    ]);
    return { items: results, total: countRow?.count ?? 0 };
  }

  async listPublishedSummariesByStory(storyId: number, limit: number, offset: number): Promise<ChapterSummaryPage> {
    const [{ results }, countRow] = await Promise.all([
      this.db
        .prepare(
          `SELECT ${CHAPTER_SUMMARY_COLUMNS} FROM chapters WHERE story_id = ? AND status = 'published' ORDER BY chapter_number ASC LIMIT ? OFFSET ?`
        )
        .bind(storyId, limit, offset)
        .all<ChapterSummaryRow>(),
      this.db
        .prepare("SELECT COUNT(*) as count FROM chapters WHERE story_id = ? AND status = 'published'")
        .bind(storyId)
        .first<{ count: number }>(),
    ]);
    return { items: results, total: countRow?.count ?? 0 };
  }

  async listFullByStory(storyId: number): Promise<ChapterRow[]> {
    const { results } = await this.db
      .prepare(`SELECT ${CHAPTER_COLUMNS} FROM chapters WHERE story_id = ? ORDER BY chapter_number ASC`)
      .bind(storyId)
      .all<ChapterRow>();
    return results;
  }

  async findByStoryAndNumber(storyId: number, chapterNumber: number): Promise<ChapterRow | null> {
    const row = await this.db
      .prepare(`SELECT ${CHAPTER_COLUMNS} FROM chapters WHERE story_id = ? AND chapter_number = ?`)
      .bind(storyId, chapterNumber)
      .first<ChapterRow>();
    return row ?? null;
  }

  async findNextChapterNumber(storyId: number, afterNumber: number): Promise<number | null> {
    const row = await this.db
      .prepare(
        "SELECT MIN(chapter_number) as next FROM chapters WHERE story_id = ? AND chapter_number > ? AND status = 'published'"
      )
      .bind(storyId, afterNumber)
      .first<{ next: number | null }>();
    return row?.next ?? null;
  }

  async maxChapterNumber(storyId: number): Promise<number> {
    const row = await this.db
      .prepare("SELECT MAX(chapter_number) as max FROM chapters WHERE story_id = ?")
      .bind(storyId)
      .first<{ max: number | null }>();
    return row?.max ?? 0;
  }

  async create(input: CreateChapterInput): Promise<ChapterRow> {
    const row = await this.db
      .prepare(
        `INSERT INTO chapters (story_id, chapter_number, title, content, content_format, generated_by, status, image_url)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         RETURNING ${CHAPTER_COLUMNS}`
      )
      .bind(
        input.storyId,
        input.chapterNumber,
        input.title,
        input.content,
        input.contentFormat,
        input.generatedBy,
        input.status,
        input.imageUrl
      )
      .first<ChapterRow>();
    return row!;
  }

  /**
   * Takes the final values to write, resolved by the caller — no COALESCE
   * "keep existing if null" magic here, since that made it impossible to
   * ever explicitly clear image_url back to null from the JS side.
   */
  async updateContent(
    storyId: number,
    chapterNumber: number,
    title: string | null,
    content: string,
    contentFormat: ChapterContentFormat,
    imageUrl: string | null
  ): Promise<ChapterRow | null> {
    const row = await this.db
      .prepare(
        `UPDATE chapters SET title = ?, content = ?, content_format = ?, image_url = ?
         WHERE story_id = ? AND chapter_number = ? RETURNING ${CHAPTER_COLUMNS}`
      )
      .bind(title, content, contentFormat, imageUrl, storyId, chapterNumber)
      .first<ChapterRow>();
    return row ?? null;
  }

  async updateStatus(storyId: number, chapterNumber: number, status: ChapterStatus): Promise<ChapterRow | null> {
    const row = await this.db
      .prepare(
        `UPDATE chapters SET status = ? WHERE story_id = ? AND chapter_number = ? RETURNING ${CHAPTER_COLUMNS}`
      )
      .bind(status, storyId, chapterNumber)
      .first<ChapterRow>();
    return row ?? null;
  }

  async deleteByStoryAndNumber(storyId: number, chapterNumber: number): Promise<void> {
    await this.db
      .prepare("DELETE FROM chapters WHERE story_id = ? AND chapter_number = ?")
      .bind(storyId, chapterNumber)
      .run();
  }

  async deleteAllForStory(storyId: number): Promise<void> {
    await this.db.prepare("DELETE FROM chapters WHERE story_id = ?").bind(storyId).run();
  }
}
