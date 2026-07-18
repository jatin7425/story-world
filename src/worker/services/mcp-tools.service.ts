import type { IStoriesRepository } from "../repositories/stories.repository";
import type { IChaptersRepository } from "../repositories/chapters.repository";
import { slugify } from "../lib/slugify";

export interface McpToolResult {
  content: { type: "text"; text: string }[];
  isError?: boolean;
}

function ok(data: unknown): McpToolResult {
  return { content: [{ type: "text", text: typeof data === "string" ? data : JSON.stringify(data, null, 2) }] };
}

function fail(message: string): McpToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

const DRAFT_NOTE = "Saved as a draft — invisible to readers until an admin publishes it.";

/**
 * The 5 MCP tools. Every write here is attributed to AI/MCP, never a human
 * author, and always lands as a draft — publishing is exclusively an admin
 * action (AdminStoryService), enforced by construction: this service has no
 * method that can set status: 'published'.
 */
export class McpToolsService {
  constructor(
    private readonly stories: IStoriesRepository,
    private readonly chapters: IChaptersRepository
  ) {}

  async listStories(): Promise<McpToolResult> {
    // Not a UI list — the AI needs the full picture, not one page at a time.
    const { items: rows } = await this.stories.listAllForAdmin(1000, 0);
    const summary = await Promise.all(
      rows.map(async (s) => {
        const chapters = await this.chapters.listSummariesByStory(s.id);
        return {
          slug: s.slug,
          title: s.title,
          description: s.description,
          status: s.status,
          free_chapter_count: s.free_chapter_count,
          tags: s.tags,
          chapter_count: chapters.length,
          draft_chapter_count: chapters.filter((c) => c.status === "draft").length,
        };
      })
    );
    return ok(summary);
  }

  async getStoryChapters(args: { story_slug?: unknown }): Promise<McpToolResult> {
    const slug = typeof args.story_slug === "string" ? args.story_slug.trim() : "";
    if (!slug) return fail("story_slug is required.");

    const story = await this.stories.findBySlug(slug);
    if (!story) return fail(`No story found with slug "${slug}". Use list_stories to see what exists.`);

    const chapters = await this.chapters.listFullByStory(story.id);
    return ok({
      story: {
        slug: story.slug,
        title: story.title,
        description: story.description,
        status: story.status,
        free_chapter_count: story.free_chapter_count,
      },
      chapters: chapters.map((c) => ({
        chapter_number: c.chapter_number,
        title: c.title,
        status: c.status,
        content: c.content,
      })),
    });
  }

  async createStory(args: {
    title?: unknown;
    description?: unknown;
    tags?: unknown;
    cover_image_url?: unknown;
    free_chapter_count?: unknown;
  }): Promise<McpToolResult> {
    const title = typeof args.title === "string" ? args.title.trim() : "";
    if (!title) return fail("title is required.");

    const slug = slugify(title);
    if (!slug) return fail("title must contain at least one letter or number.");

    const existing = await this.stories.findBySlug(slug);
    if (existing) {
      return fail(
        `A story with slug "${slug}" already exists (status: ${existing.status}). Use get_story_chapters to read it, or create_chapter to add to it, instead of creating a duplicate.`
      );
    }

    const story = await this.stories.create({
      title,
      slug,
      description: typeof args.description === "string" ? args.description.trim() || null : null,
      coverImageUrl: typeof args.cover_image_url === "string" ? args.cover_image_url.trim() || null : null,
      freeChapterCount: typeof args.free_chapter_count === "number" ? args.free_chapter_count : 3,
      tags: typeof args.tags === "string" ? args.tags.trim() || null : null,
      createdVia: "mcp",
      status: "draft",
    });

    return ok({ message: `Created story "${story.title}". ${DRAFT_NOTE}`, slug: story.slug, status: story.status });
  }

  async createChapter(args: {
    story_slug?: unknown;
    title?: unknown;
    content?: unknown;
    image_url?: unknown;
  }): Promise<McpToolResult> {
    const slug = typeof args.story_slug === "string" ? args.story_slug.trim() : "";
    const content = typeof args.content === "string" ? args.content : "";
    if (!slug) return fail("story_slug is required.");
    if (!content.trim()) return fail("content is required.");

    const story = await this.stories.findBySlug(slug);
    if (!story) return fail(`No story found with slug "${slug}". Use list_stories to see what exists.`);

    const nextNumber = (await this.chapters.maxChapterNumber(story.id)) + 1;
    const chapter = await this.chapters.create({
      storyId: story.id,
      chapterNumber: nextNumber,
      title: typeof args.title === "string" ? args.title.trim() || null : null,
      content,
      contentFormat: "markdown",
      generatedBy: "mcp",
      status: "draft",
      imageUrl: typeof args.image_url === "string" ? args.image_url.trim() || null : null,
    });

    return ok({
      message: `Created chapter ${chapter.chapter_number} of "${story.title}". ${DRAFT_NOTE}`,
      story_slug: story.slug,
      chapter_number: chapter.chapter_number,
      status: chapter.status,
    });
  }

  async editChapter(args: {
    story_slug?: unknown;
    chapter_number?: unknown;
    title?: unknown;
    content?: unknown;
    image_url?: unknown;
  }): Promise<McpToolResult> {
    const slug = typeof args.story_slug === "string" ? args.story_slug.trim() : "";
    const chapterNumber = typeof args.chapter_number === "number" ? args.chapter_number : NaN;
    if (!slug) return fail("story_slug is required.");
    if (!Number.isFinite(chapterNumber)) return fail("chapter_number is required and must be a number.");

    const story = await this.stories.findBySlug(slug);
    if (!story) return fail(`No story found with slug "${slug}".`);

    const chapter = await this.chapters.findByStoryAndNumber(story.id, chapterNumber);
    if (!chapter) return fail(`Chapter ${chapterNumber} not found in "${slug}".`);
    if (chapter.status === "published") {
      return fail(
        `Chapter ${chapterNumber} of "${slug}" is already published and can't be edited via MCP. Ask an admin to unpublish it first if it needs changes.`
      );
    }

    const title = typeof args.title === "string" ? args.title.trim() || null : chapter.title;
    const content = typeof args.content === "string" && args.content.trim() ? args.content : chapter.content;
    const imageUrl = typeof args.image_url === "string" ? args.image_url.trim() || null : chapter.image_url;

    const updated = await this.chapters.updateContent(story.id, chapterNumber, title, content, "markdown", imageUrl);

    return ok({
      message: `Updated draft chapter ${chapterNumber} of "${story.title}".`,
      story_slug: story.slug,
      chapter_number: updated?.chapter_number ?? chapterNumber,
      status: updated?.status ?? chapter.status,
    });
  }

  async explainSite(): Promise<McpToolResult> {
    return ok(
      "This site is a story platform where MCP-created content is always stored as a draft. " +
        "Stories and chapters written or edited by the AI are not visible to readers until an admin reviews and publishes them. " +
        "Use list_stories to inspect existing stories and draft counts, get_story_chapters to load a story's full chapter history and status, " +
        "create_story to start a new draft story, create_chapter to append a draft chapter, and edit_chapter to modify an existing draft chapter. " +
        "Do not expect MCP actions to publish automatically; publication is an explicit admin-only step. " +
        "When creating a story, you can include tags, a cover image URL, and a free chapter count; chapters support a title, markdown content, and optional image URL."
    );
  }
}
