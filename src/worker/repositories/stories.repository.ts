import type { StoryRow } from "./types";

const STORY_COLUMNS = `id, title, slug, description, cover_image_url, author_id, status,
                        free_chapter_count, is_ai_generated, ai_generation_prompt, tags, created_via,
                        age_rating, age_rating_reason, age_rating_source, created_at`;

export interface CreateStoryInput {
  title: string;
  slug: string;
  description: string | null;
  coverImageUrl: string | null;
  freeChapterCount: number;
  tags: string | null;
  createdVia: "admin" | "mcp";
  status: string;
}

export interface UpdateStoryInput {
  title?: string;
  description?: string | null;
  coverImageUrl?: string | null;
  freeChapterCount?: number;
  status?: string;
  tags?: string | null;
}

export interface StoryPage {
  items: StoryRow[];
  total: number;
}

export interface IStoriesRepository {
  listPublished(limit: number, offset: number): Promise<StoryPage>;
  listAllForAdmin(limit: number, offset: number): Promise<StoryPage>;
  findPublishedBySlug(slug: string): Promise<StoryRow | null>;
  /** No status filter — admin/MCP use, where drafts must still be reachable. */
  findBySlug(slug: string): Promise<StoryRow | null>;
  findById(id: number): Promise<StoryRow | null>;
  create(input: CreateStoryInput): Promise<StoryRow>;
  update(id: number, patch: UpdateStoryInput): Promise<StoryRow | null>;
  delete(id: number): Promise<void>;
  /** Word-wise match across title/description/tags — every word in the query must appear somewhere. */
  search(words: string[], limit: number, offset: number): Promise<StoryPage>;
  updateAgeRating(id: number, ageRating: string, reason: string | null, source: "ai" | "admin"): Promise<StoryRow | null>;
}

export class StoriesRepository implements IStoriesRepository {
  constructor(private readonly db: D1Database) {}

  async listPublished(limit: number, offset: number): Promise<StoryPage> {
    const [{ results }, countRow] = await Promise.all([
      this.db
        .prepare(`SELECT ${STORY_COLUMNS} FROM stories WHERE status = 'published' ORDER BY created_at DESC LIMIT ? OFFSET ?`)
        .bind(limit, offset)
        .all<StoryRow>(),
      this.db.prepare("SELECT COUNT(*) as count FROM stories WHERE status = 'published'").first<{ count: number }>(),
    ]);
    return { items: results, total: countRow?.count ?? 0 };
  }

  async listAllForAdmin(limit: number, offset: number): Promise<StoryPage> {
    const [{ results }, countRow] = await Promise.all([
      this.db
        .prepare(`SELECT ${STORY_COLUMNS} FROM stories ORDER BY created_at DESC LIMIT ? OFFSET ?`)
        .bind(limit, offset)
        .all<StoryRow>(),
      this.db.prepare("SELECT COUNT(*) as count FROM stories").first<{ count: number }>(),
    ]);
    return { items: results, total: countRow?.count ?? 0 };
  }

  async findPublishedBySlug(slug: string): Promise<StoryRow | null> {
    const row = await this.db
      .prepare(`SELECT ${STORY_COLUMNS} FROM stories WHERE slug = ? AND status = 'published'`)
      .bind(slug)
      .first<StoryRow>();
    return row ?? null;
  }

  async findBySlug(slug: string): Promise<StoryRow | null> {
    const row = await this.db.prepare(`SELECT ${STORY_COLUMNS} FROM stories WHERE slug = ?`).bind(slug).first<StoryRow>();
    return row ?? null;
  }

  async findById(id: number): Promise<StoryRow | null> {
    const row = await this.db.prepare(`SELECT ${STORY_COLUMNS} FROM stories WHERE id = ?`).bind(id).first<StoryRow>();
    return row ?? null;
  }

  async create(input: CreateStoryInput): Promise<StoryRow> {
    const row = await this.db
      .prepare(
        `INSERT INTO stories (title, slug, description, cover_image_url, free_chapter_count, tags, created_via, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         RETURNING ${STORY_COLUMNS}`
      )
      .bind(
        input.title,
        input.slug,
        input.description,
        input.coverImageUrl,
        input.freeChapterCount,
        input.tags,
        input.createdVia,
        input.status
      )
      .first<StoryRow>();
    return row!;
  }

  async update(id: number, patch: UpdateStoryInput): Promise<StoryRow | null> {
    const sets: string[] = [];
    const values: unknown[] = [];

    if (patch.title !== undefined) {
      sets.push("title = ?");
      values.push(patch.title);
    }
    if (patch.description !== undefined) {
      sets.push("description = ?");
      values.push(patch.description);
    }
    if (patch.coverImageUrl !== undefined) {
      sets.push("cover_image_url = ?");
      values.push(patch.coverImageUrl);
    }
    if (patch.freeChapterCount !== undefined) {
      sets.push("free_chapter_count = ?");
      values.push(patch.freeChapterCount);
    }
    if (patch.status !== undefined) {
      sets.push("status = ?");
      values.push(patch.status);
    }
    if (patch.tags !== undefined) {
      sets.push("tags = ?");
      values.push(patch.tags);
    }

    if (sets.length === 0) return this.findById(id);

    values.push(id);
    const row = await this.db
      .prepare(`UPDATE stories SET ${sets.join(", ")} WHERE id = ? RETURNING ${STORY_COLUMNS}`)
      .bind(...values)
      .first<StoryRow>();
    return row ?? null;
  }

  async delete(id: number): Promise<void> {
    await this.db.prepare("DELETE FROM stories WHERE id = ?").bind(id).run();
  }

  async search(words: string[], limit: number, offset: number): Promise<StoryPage> {
    if (words.length === 0) return this.listPublished(limit, offset);

    const escapeLike = (s: string) => s.replace(/[%_\\]/g, (c) => `\\${c}`);
    const conditions = words
      .map(() => `(title LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\' OR tags LIKE ? ESCAPE '\\')`)
      .join(" AND ");
    const values = words.flatMap((w) => {
      const pattern = `%${escapeLike(w)}%`;
      return [pattern, pattern, pattern];
    });

    const whereClause = `status = 'published' AND (${conditions})`;
    const [{ results }, countRow] = await Promise.all([
      this.db
        .prepare(`SELECT ${STORY_COLUMNS} FROM stories WHERE ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
        .bind(...values, limit, offset)
        .all<StoryRow>(),
      this.db
        .prepare(`SELECT COUNT(*) as count FROM stories WHERE ${whereClause}`)
        .bind(...values)
        .first<{ count: number }>(),
    ]);
    return { items: results, total: countRow?.count ?? 0 };
  }

  async updateAgeRating(id: number, ageRating: string, reason: string | null, source: "ai" | "admin"): Promise<StoryRow | null> {
    const row = await this.db
      .prepare(`UPDATE stories SET age_rating = ?, age_rating_reason = ?, age_rating_source = ? WHERE id = ? RETURNING ${STORY_COLUMNS}`)
      .bind(ageRating, reason, source, id)
      .first<StoryRow>();
    return row ?? null;
  }
}
