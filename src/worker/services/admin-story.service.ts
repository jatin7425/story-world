import type { IStoriesRepository } from "../repositories/stories.repository";
import type { IChaptersRepository } from "../repositories/chapters.repository";
import type { ICommentsRepository } from "../repositories/comments.repository";
import type { ILikesRepository } from "../repositories/likes.repository";
import type { IFollowsRepository } from "../repositories/follows.repository";
import type { StoryRow, ChapterRow, ChapterSummaryRow, ChapterContentFormat } from "../repositories/types";
import { slugify } from "../lib/slugify";
import { toPaginated, type Paginated } from "../lib/pagination";
import { sanitizeChapterHtml } from "../lib/html-sanitizer";

export interface CreateStoryAdminInput {
  title: string;
  description?: string;
  coverImageUrl?: string;
  freeChapterCount?: number;
  tags?: string;
}

export interface UpdateStoryAdminInput {
  title?: string;
  description?: string | null;
  coverImageUrl?: string | null;
  freeChapterCount?: number;
  status?: string;
  tags?: string | null;
}

export interface AddChapterAdminInput {
  title?: string;
  content: string;
  contentFormat?: ChapterContentFormat;
  imageUrl?: string | null;
}

export interface UpdateChapterAdminInput {
  title?: string | null;
  content?: string;
  contentFormat?: ChapterContentFormat;
  imageUrl?: string | null;
}

/** HTML content always passes through the allow-list sanitizer before storage — see html-sanitizer.ts for why. */
async function resolveContent(content: string, format: ChapterContentFormat): Promise<string> {
  return format === "html" ? sanitizeChapterHtml(content) : content;
}

/**
 * Everything an admin can do to stories/chapters. Deliberately its own
 * service, never imported by reader-facing services — the admin surface is
 * a distinct entity from the public read/browse/comment path. User
 * moderation (bans, restrictions) lives in AdminUserService instead of
 * here, since it's a different concern with different collaborators.
 *
 * Admin-authored content is always trusted and goes live immediately
 * (status: 'published') — the draft gate is specific to MCP/AI-authored
 * content, handled by McpToolsService instead.
 */
export class AdminStoryService {
  constructor(
    private readonly stories: IStoriesRepository,
    private readonly chapters: IChaptersRepository,
    private readonly comments: ICommentsRepository,
    private readonly likes: ILikesRepository,
    private readonly follows: IFollowsRepository
  ) {}

  async listStories(page: number, limit: number): Promise<Paginated<StoryRow>> {
    const { items, total } = await this.stories.listAllForAdmin(limit, (page - 1) * limit);
    return toPaginated(items, total, page, limit);
  }

  getStory(id: number): Promise<StoryRow | null> {
    return this.stories.findById(id);
  }

  createStory(input: CreateStoryAdminInput): Promise<StoryRow> {
    return this.stories.create({
      title: input.title,
      slug: slugify(input.title),
      description: input.description ?? null,
      coverImageUrl: input.coverImageUrl ?? null,
      freeChapterCount: input.freeChapterCount ?? 3,
      tags: input.tags ?? null,
      createdVia: "admin",
      status: "published",
    });
  }

  updateStory(id: number, patch: UpdateStoryAdminInput): Promise<StoryRow | null> {
    return this.stories.update(id, patch);
  }

  async deleteStory(id: number): Promise<void> {
    const chapters = await this.chapters.listSummariesByStory(id);
    const chapterIds = chapters.map((c) => c.id);
    await this.comments.deleteForChapters(chapterIds);
    await this.likes.deleteForChapters(chapterIds);
    await this.chapters.deleteAllForStory(id);
    await this.follows.deleteForStory(id);
    await this.stories.delete(id);
  }

  async listChapters(storyId: number, page: number, limit: number): Promise<Paginated<ChapterSummaryRow>> {
    const { items, total } = await this.chapters.listSummariesByStoryPaged(storyId, limit, (page - 1) * limit);
    return toPaginated(items, total, page, limit);
  }

  async addChapter(storyId: number, input: AddChapterAdminInput): Promise<ChapterRow> {
    const nextNumber = (await this.chapters.maxChapterNumber(storyId)) + 1;
    const contentFormat = input.contentFormat ?? "markdown";
    return this.chapters.create({
      storyId,
      chapterNumber: nextNumber,
      title: input.title ?? null,
      content: await resolveContent(input.content, contentFormat),
      contentFormat,
      generatedBy: "admin",
      status: "published",
      imageUrl: input.imageUrl ?? null,
    });
  }

  getChapter(storyId: number, chapterNumber: number): Promise<ChapterRow | null> {
    return this.chapters.findByStoryAndNumber(storyId, chapterNumber);
  }

  /**
   * Unlike McpToolsService.editChapter, this has no draft-only restriction —
   * an admin reviewing/correcting content is trusted regardless of whether
   * it's already live.
   */
  async updateChapter(
    storyId: number,
    chapterNumber: number,
    patch: UpdateChapterAdminInput
  ): Promise<ChapterRow | null> {
    const existing = await this.chapters.findByStoryAndNumber(storyId, chapterNumber);
    if (!existing) return null;

    const contentFormat = patch.contentFormat ?? existing.content_format;
    const content =
      patch.content !== undefined ? await resolveContent(patch.content, contentFormat) : existing.content;

    return this.chapters.updateContent(
      storyId,
      chapterNumber,
      patch.title !== undefined ? patch.title : existing.title,
      content,
      contentFormat,
      patch.imageUrl !== undefined ? patch.imageUrl : existing.image_url
    );
  }

  async deleteChapter(storyId: number, chapterNumber: number): Promise<void> {
    const chapter = await this.chapters.findByStoryAndNumber(storyId, chapterNumber);
    if (!chapter) return;
    await this.comments.deleteForChapters([chapter.id]);
    await this.likes.deleteForChapters([chapter.id]);
    await this.chapters.deleteByStoryAndNumber(storyId, chapterNumber);
  }

  publishChapter(storyId: number, chapterNumber: number): Promise<ChapterRow | null> {
    return this.chapters.updateStatus(storyId, chapterNumber, "published");
  }

  unpublishChapter(storyId: number, chapterNumber: number): Promise<ChapterRow | null> {
    return this.chapters.updateStatus(storyId, chapterNumber, "draft");
  }
}
