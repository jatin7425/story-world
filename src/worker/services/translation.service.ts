import type { IStoryTranslationsRepository } from "../repositories/story-translations.repository";
import type { IChapterTranslationsRepository } from "../repositories/chapter-translations.repository";
import type { ChapterContentFormat } from "../repositories/types";
import type { SupportedLang } from "../lib/translation-prompt";

export interface StoryTranslationView {
  title: string;
  description: string | null;
}

export interface ChapterTranslationView {
  title: string | null;
  content: string;
  content_format: ChapterContentFormat;
}

/**
 * Pure cache-read API used by the reader-facing routes (StoryService/
 * ChapterService) — NEVER calls a translation provider. Only
 * TranslationJobService (admin-only) ever generates a translation; this
 * class either finds a cached row or returns null, so a reader's request can
 * never trigger live LLM usage.
 */
export class TranslationService {
  constructor(
    private readonly storyTranslations: IStoryTranslationsRepository,
    private readonly chapterTranslations: IChapterTranslationsRepository
  ) {}

  async findStoryTranslation(storyId: number, lang: SupportedLang): Promise<StoryTranslationView | null> {
    const row = await this.storyTranslations.find(storyId, lang);
    if (!row) return null;
    return { title: row.title, description: row.description };
  }

  async findChapterTranslation(chapterId: number, lang: SupportedLang): Promise<ChapterTranslationView | null> {
    const row = await this.chapterTranslations.find(chapterId, lang);
    if (!row) return null;
    return { title: row.title, content: row.content, content_format: row.content_format };
  }

  invalidateStory(storyId: number): Promise<void> {
    return this.storyTranslations.deleteForStory(storyId);
  }

  invalidateChapter(chapterId: number): Promise<void> {
    return this.chapterTranslations.deleteForChapter(chapterId);
  }

  invalidateChapters(chapterIds: number[]): Promise<void> {
    return this.chapterTranslations.deleteForChapters(chapterIds);
  }
}
