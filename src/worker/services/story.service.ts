import type { IStoriesRepository } from "../repositories/stories.repository";
import type { IChaptersRepository } from "../repositories/chapters.repository";
import type { IFollowsRepository } from "../repositories/follows.repository";
import type { StoryRow, ChapterSummaryRow } from "../repositories/types";

export interface StoryDetail {
  story: StoryRow;
  chapters: ChapterSummaryRow[];
  followersCount: number;
  isFollowing: boolean;
}

export class StoryService {
  constructor(
    private readonly stories: IStoriesRepository,
    private readonly chapters: IChaptersRepository,
    private readonly follows: IFollowsRepository
  ) {}

  listStories(query?: string): Promise<StoryRow[]> {
    const words = tokenize(query);
    return words.length > 0 ? this.stories.search(words) : this.stories.listPublished();
  }

  /** Narrow lookup for SEO meta-tag rendering — skips the chapter/follow queries getStoryDetail does. */
  findStoryMeta(slug: string): Promise<StoryRow | null> {
    return this.stories.findPublishedBySlug(slug);
  }

  async getStoryDetail(slug: string, currentUserId: number | null): Promise<StoryDetail | null> {
    const story = await this.stories.findPublishedBySlug(slug);
    if (!story) return null;

    const [chapters, followersCount, isFollowing] = await Promise.all([
      this.chapters.listPublishedSummariesByStory(story.id),
      this.follows.countForStory(story.id),
      currentUserId ? this.follows.isFollowing(currentUserId, story.id) : Promise.resolve(false),
    ]);

    return { story, chapters, followersCount, isFollowing };
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
