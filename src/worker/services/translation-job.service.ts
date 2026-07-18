import type { IStoriesRepository } from "../repositories/stories.repository";
import type { IChaptersRepository } from "../repositories/chapters.repository";
import type { IStoryTranslationsRepository } from "../repositories/story-translations.repository";
import type { IChapterTranslationsRepository } from "../repositories/chapter-translations.repository";
import type { ITranslationJobsRepository, CreateJobItemInput, JobWithItems } from "../repositories/translation-jobs.repository";
import type { TranslationJobItemRow, TranslationJobStatus } from "../repositories/types";
import type { TranslationProvider, ProviderAttempt } from "../lib/translation-providers";
import { translateViaProviders } from "../lib/translation-providers";
import { buildLiteraryPrompt, buildShortTextPrompt, type SupportedLang } from "../lib/translation-prompt";
import { parseIntoSegments, groupIntoChunks, buildChunkUserMessage, splitChunkResponse, reassembleSegments } from "../lib/chunking";
import { sanitizeChapterHtml } from "../lib/html-sanitizer";

export interface CreateTranslationJobInput {
  storyId: number;
  chapterIds: number[];
  includeStory: boolean;
  langs: SupportedLang[];
}

export type StepResult =
  | { done: true }
  | { item: TranslationJobItemRow; completedItems: number; totalItems: number; jobStatus: TranslationJobStatus };

function fmtAttempt(a: ProviderAttempt): string {
  return a.ok ? `[${a.provider}] success` : `[${a.provider}] failed: ${a.error}`;
}

/**
 * The only thing in this codebase that ever calls a translation provider —
 * reader-facing routes only read from the cache tables (TranslationService).
 * Driven by the admin's browser one step at a time (see stepJob) rather than
 * running a whole batch in one request, so a job of any size stays safe
 * against Workers' per-request subrequest/CPU limits.
 */
export class TranslationJobService {
  constructor(
    private readonly jobs: ITranslationJobsRepository,
    private readonly stories: IStoriesRepository,
    private readonly chapters: IChaptersRepository,
    private readonly storyTranslations: IStoryTranslationsRepository,
    private readonly chapterTranslations: IChapterTranslationsRepository,
    private readonly providers: TranslationProvider[],
    private readonly aion: TranslationProvider | undefined
  ) {}

  async createJob(input: CreateTranslationJobInput, adminUserId: number): Promise<JobWithItems> {
    const story = await this.stories.findById(input.storyId);
    if (!story) throw new Error("Story not found");
    if (input.langs.length === 0) throw new Error("Select at least one language");

    const items: CreateJobItemInput[] = [];
    if (input.includeStory) {
      for (const lang of input.langs) items.push({ entityType: "story", entityId: story.id, entityLabel: story.title, lang });
    }
    for (const chapterId of input.chapterIds) {
      const chapter = await this.chapters.findById(chapterId);
      if (!chapter || chapter.story_id !== story.id) continue;
      const label = `Chapter ${chapter.chapter_number}${chapter.title ? `: ${chapter.title}` : ""}`;
      for (const lang of input.langs) items.push({ entityType: "chapter", entityId: chapter.id, entityLabel: label, lang });
    }

    if (items.length === 0) throw new Error("No items to translate — select at least one chapter or the story description, plus a language");

    return this.jobs.createJob(adminUserId, items);
  }

  getJob(jobId: number): Promise<JobWithItems | null> {
    return this.jobs.findJob(jobId);
  }

  async stepJob(jobId: number): Promise<StepResult> {
    const item = await this.jobs.findNextPendingItem(jobId);
    if (!item) {
      await this.jobs.recomputeJobStatus(jobId);
      return { done: true };
    }

    await this.jobs.updateItem(item.id, { status: "running" });
    const logLines: string[] = [];
    let providerUsed: string | null = null;
    try {
      providerUsed = await this.runItem(item, logLines);
      await this.jobs.updateItem(item.id, { status: "done", providerUsed, log: logLines.join("\n") });
    } catch (err) {
      await this.jobs.updateItem(item.id, {
        status: "failed",
        providerUsed,
        log: logLines.join("\n"),
        errorMessage: err instanceof Error ? err.message : String(err),
      });
    }

    await this.jobs.incrementCompleted(jobId);
    await this.jobs.recomputeJobStatus(jobId);

    const jobWithItems = await this.jobs.findJob(jobId);
    const updatedItem = jobWithItems!.items.find((i) => i.id === item.id)!;
    return {
      item: updatedItem,
      completedItems: jobWithItems!.job.completed_items,
      totalItems: jobWithItems!.job.total_items,
      jobStatus: jobWithItems!.job.status,
    };
  }

  /** Returns the provider that ultimately produced the translation ("cache" if it was already cached). Pushes an attempt trail into `logLines` as it goes. */
  private async runItem(item: TranslationJobItemRow, logLines: string[]): Promise<string> {
    const lang = item.lang as SupportedLang;

    if (item.entity_type === "story") {
      const cached = await this.storyTranslations.find(item.entity_id, lang);
      if (cached) {
        logLines.push("Already cached — skipped provider call.");
        return "cache";
      }
      const story = await this.stories.findById(item.entity_id);
      if (!story) throw new Error("Story no longer exists");

      // Titles are deliberately left in English, not translated — a short
      // free-tier model call for a 2-4 word title was unreliably following
      // "output only the translated text" and returning a full paragraph
      // instead (observed in production). Only the description gets translated.
      let description: string | null = null;
      let providerUsed = "cache";
      if (story.description) {
        const descResult = await translateViaProviders(this.providers, buildShortTextPrompt(lang), story.description, this.aion);
        logLines.push(...descResult.attempts.map(fmtAttempt));
        description = descResult.text;
        providerUsed = descResult.provider;
      }

      await this.storyTranslations.upsert(story.id, lang, story.title, description);
      await this.stories.addLang(story.id, lang);
      return providerUsed;
    }

    // chapter
    const cached = await this.chapterTranslations.find(item.entity_id, lang);
    if (cached) {
      logLines.push("Already cached — skipped provider call.");
      return "cache";
    }
    const chapter = await this.chapters.findById(item.entity_id);
    if (!chapter) throw new Error("Chapter no longer exists");

    // Title left in English for the same reason as the story title above.
    let providerUsed = "cache";

    const segments = parseIntoSegments(chapter.content, chapter.content_format);
    const chunks = groupIntoChunks(segments, chapter.content_format);
    const translatedByIndex = new Map<number, string>();
    const systemPrompt = buildLiteraryPrompt(lang);

    for (const chunk of chunks) {
      const userMessage = buildChunkUserMessage(chunk.texts);
      const result = await translateViaProviders(this.providers, systemPrompt, userMessage, this.aion);
      logLines.push(...result.attempts.map(fmtAttempt));
      providerUsed = result.provider;

      const parts = splitChunkResponse(result.text, chunk.texts.length);
      if (!parts) {
        logLines.push(`Chunk of ${chunk.texts.length} segment(s): translated segment count mismatch — kept original English for this chunk.`);
        continue;
      }
      chunk.indices.forEach((idx, i) => translatedByIndex.set(idx, parts[i]));
    }

    const reassembled = reassembleSegments(segments, translatedByIndex, chapter.content_format);
    const finalContent = chapter.content_format === "html" ? await sanitizeChapterHtml(reassembled) : reassembled;

    await this.chapterTranslations.upsert(chapter.id, lang, chapter.title, finalContent, chapter.content_format);
    await this.chapters.addLang(chapter.id, lang);
    return providerUsed;
  }
}
