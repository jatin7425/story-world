import type { IStoriesRepository } from "../repositories/stories.repository";
import type { IChaptersRepository } from "../repositories/chapters.repository";
import type { IFollowsRepository } from "../repositories/follows.repository";
import type { StoryRow, ChapterSummaryRow } from "../repositories/types";
import { toPaginated, type Paginated } from "../lib/pagination";
import type { TranslationService } from "./translation.service";
import { isSupportedLang, type Lang } from "../lib/translation-prompt";

export interface StoryDetail {
  story: StoryRow;
  chapters: Paginated<ChapterSummaryRow>;
  followersCount: number;
  isFollowing: boolean;
  translationLang: Lang;
  translationAvailable: boolean;
}

export class StoryService {
  constructor(
    private readonly stories: IStoriesRepository,
    private readonly chapters: IChaptersRepository,
    private readonly follows: IFollowsRepository,
    private readonly translations: TranslationService
  ) {}

  async listStories(page: number, limit: number, query?: string): Promise<Paginated<StoryRow>> {
    const words = tokenize(query);
    const offset = (page - 1) * limit;
    const { items, total } =
      words.length > 0 ? await this.stories.search(words, limit, offset) : await this.stories.listPublished(limit, offset);
    return toPaginated(items, total, page, limit);
  }

  /** Narrow lookup for SEO meta-tag rendering — skips the chapter/follow queries getStoryDetail does. */
  findStoryMeta(slug: string): Promise<StoryRow | null> {
    return this.stories.findPublishedBySlug(slug);
  }

  async getStoryDetail(
    slug: string,
    currentUserId: number | null,
    chapterPage: number,
    chapterLimit: number,
    lang: string = "en"
  ): Promise<StoryDetail | null> {
    const story = await this.stories.findPublishedBySlug(slug);
    if (!story) return null;

    const chapterOffset = (chapterPage - 1) * chapterLimit;
    const [chapterPageResult, followersCount, isFollowing] = await Promise.all([
      this.chapters.listPublishedSummariesByStory(story.id, chapterLimit, chapterOffset),
      this.follows.countForStory(story.id),
      currentUserId ? this.follows.isFollowing(currentUserId, story.id) : Promise.resolve(false),
    ]);

    // Pure cache read — never triggers a live translation (see TranslationService).
    let translatedStory = story;
    let translationAvailable = true;
    if (isSupportedLang(lang)) {
      const translation = await this.translations.findStoryTranslation(story.id, lang);
      if (translation) {
        translatedStory = { ...story, title: translation.title, description: translation.description };
      } else {
        translationAvailable = false;
      }
    }

    return {
      story: translatedStory,
      chapters: toPaginated(chapterPageResult.items, chapterPageResult.total, chapterPage, chapterLimit),
      followersCount,
      isFollowing,
      translationLang: translationAvailable && isSupportedLang(lang) ? lang : "en",
      translationAvailable,
    };
  }

  async follow(userId: number, slug: string): Promise<{ ok: true } | { error: string }> {
    const story = await this.stories.findPublishedBySlug(slug);
    if (!story) return { error: "Story not found" };
    await this.follows.follow(userId, story.id);
    return { ok: true };
  }

  async unfollow(userId: number, slug: string): Promise<{ ok: true } | { error: string }> {
    const story = await this.stories.findPublishedBySlug(slug);
    if (!story) return { error: "Story not found" };
    await this.follows.unfollow(userId, story.id);
    return { ok: true };
  }
}

function tokenize(query: string | undefined): string[] {
  if (!query) return [];
  return query
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 8); // defensive cap — a search box isn't meant to take paragraphs
}
