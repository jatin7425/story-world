import type { IStoriesRepository } from "../repositories/stories.repository";
import type { IChaptersRepository } from "../repositories/chapters.repository";
import type { ILikesRepository } from "../repositories/likes.repository";
import type { IRestrictionsRepository } from "../repositories/restrictions.repository";
import type { AgeRating, ChapterRow } from "../repositories/types";
import type { AuthUser } from "../types";
import { ageFromBirthdate } from "../lib/age";

export type AgeRestrictedReason = "login_required" | "birthdate_required" | "underage";

export type ChapterResult =
  | { kind: "not_found" }
  | { kind: "locked"; chapterNumber: number }
  | { kind: "age_restricted"; reason: AgeRestrictedReason }
  | {
      kind: "ok";
      chapter: ChapterRow;
      storyTitle: string;
      storyCoverImageUrl: string | null;
      storyAgeRating: AgeRating | null;
      likeCount: number;
      likedByMe: boolean;
      nextChapterNumber: number | null;
    };

export class ChapterService {
  constructor(
    private readonly stories: IStoriesRepository,
    private readonly chapters: IChaptersRepository,
    private readonly likes: ILikesRepository,
    private readonly restrictions: IRestrictionsRepository
  ) {}

  async getChapter(slug: string, chapterNumber: number, user: AuthUser | null): Promise<ChapterResult> {
    const story = await this.stories.findPublishedBySlug(slug);
    if (!story) return { kind: "not_found" };

    const chapter = await this.chapters.findByStoryAndNumber(story.id, chapterNumber);
    // Draft chapters (MCP-authored, not yet approved) don't exist as far as
    // readers are concerned — same response as a missing chapter, no hint
    // that unpublished content exists at this URL.
    if (!chapter || chapter.status !== "published") return { kind: "not_found" };

    // 18+ content is enforced server-side: it requires an account whose
    // set-once birthdate shows the reader is an adult. Milder ratings
    // (13+/16+) stay a client-side self-declared gate — requiring login for
    // those would hurt growth more than the advisory is worth.
    if (story.age_rating === "18+") {
      if (!user) return { kind: "age_restricted", reason: "login_required" };
      const age = ageFromBirthdate(user.birthdate);
      if (age == null) return { kind: "age_restricted", reason: "birthdate_required" };
      if (age < 18) return { kind: "age_restricted", reason: "underage" };
    }

    const currentUserId = user?.id ?? null;

    // Gate: chapters beyond the story's free_chapter_count require login.
    // Centralized here so a future paid-tier check only needs to change this
    // one condition, not every caller.
    const isFree = chapter.chapter_number <= story.free_chapter_count;
    if (!isFree && !currentUserId) return { kind: "locked", chapterNumber: chapter.chapter_number };

    const [likeCount, likedByMe, nextChapterNumber] = await Promise.all([
      this.likes.countForChapter(chapter.id),
      currentUserId ? this.likes.isLikedBy(currentUserId, chapter.id) : Promise.resolve(false),
      this.chapters.findNextChapterNumber(story.id, chapterNumber),
    ]);

    return {
      kind: "ok",
      chapter,
      storyTitle: story.title,
      storyCoverImageUrl: story.cover_image_url,
      storyAgeRating: story.age_rating,
      likeCount,
      likedByMe,
      nextChapterNumber,
    };
  }

  /** Narrow lookup for SEO meta-tag rendering — skips the like/next-chapter queries getChapter does. */
  async findChapterMeta(
    slug: string,
    chapterNumber: number
  ): Promise<{ storyTitle: string; coverImageUrl: string | null; chapterTitle: string | null; content: string } | null> {
    const story = await this.stories.findPublishedBySlug(slug);
    if (!story) return null;
    const chapter = await this.chapters.findByStoryAndNumber(story.id, chapterNumber);
    if (!chapter || chapter.status !== "published") return null;
    return {
      storyTitle: story.title,
      coverImageUrl: story.cover_image_url,
      chapterTitle: chapter.title,
      content: chapter.content,
    };
  }

  async like(userId: number, chapterId: number): Promise<{ ok: true } | { error: string }> {
    if (await this.restrictions.has(userId, "react")) {
      return { error: "You've been restricted from reacting to chapters" };
    }
    await this.likes.like(userId, chapterId);
    return { ok: true };
  }

  unlike(userId: number, chapterId: number): Promise<void> {
    return this.likes.unlike(userId, chapterId);
  }
}
