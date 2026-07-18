import type { StoryTranslationRow } from "./types";

export interface IStoryTranslationsRepository {
  find(storyId: number, lang: string): Promise<StoryTranslationRow | null>;
  upsert(storyId: number, lang: string, title: string, description: string | null): Promise<StoryTranslationRow>;
  deleteForStory(storyId: number): Promise<void>;
  deleteOne(storyId: number, lang: string): Promise<void>;
}

export class StoryTranslationsRepository implements IStoryTranslationsRepository {
  constructor(private readonly db: D1Database) {}

  async find(storyId: number, lang: string): Promise<StoryTranslationRow | null> {
    const row = await this.db
      .prepare("SELECT id, story_id, lang, title, description, created_at FROM story_translations WHERE story_id = ? AND lang = ?")
      .bind(storyId, lang)
      .first<StoryTranslationRow>();
    return row ?? null;
  }

  async upsert(storyId: number, lang: string, title: string, description: string | null): Promise<StoryTranslationRow> {
    const row = await this.db
      .prepare(
        `INSERT INTO story_translations (story_id, lang, title, description)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(story_id, lang) DO UPDATE SET title = excluded.title, description = excluded.description, created_at = CURRENT_TIMESTAMP
         RETURNING id, story_id, lang, title, description, created_at`
      )
      .bind(storyId, lang, title, description)
      .first<StoryTranslationRow>();
    return row!;
  }

  async deleteForStory(storyId: number): Promise<void> {
    await this.db.prepare("DELETE FROM story_translations WHERE story_id = ?").bind(storyId).run();
  }

  async deleteOne(storyId: number, lang: string): Promise<void> {
    await this.db.prepare("DELETE FROM story_translations WHERE story_id = ? AND lang = ?").bind(storyId, lang).run();
  }
}
