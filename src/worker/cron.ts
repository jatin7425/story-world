import type { Env } from "./types";
import { generateNextChapter } from "./lib/ai";

interface AiStory {
  id: number;
  title: string;
  description: string | null;
  ai_generation_prompt: string | null;
}

/**
 * Runs once a day (see [triggers] in wrangler.toml). For every story flagged
 * is_ai_generated, generates and appends the next chapter. Failures for one
 * story don't block the others.
 */
export async function runDailyChapterGeneration(env: Env): Promise<void> {
  const { results: stories } = await env.DB.prepare(
    `SELECT id, title, description, ai_generation_prompt
     FROM stories WHERE is_ai_generated = 1 AND status = 'published'`
  ).all<AiStory>();

  for (const story of stories) {
    try {
      const { results: previousChapters } = await env.DB.prepare(
        `SELECT chapter_number, title, content FROM chapters
         WHERE story_id = ? ORDER BY chapter_number DESC LIMIT 3`
      )
        .bind(story.id)
        .all<{ chapter_number: number; title: string | null; content: string }>();

      const generated = await generateNextChapter(env, {
        storyTitle: story.title,
        storyDescription: story.description,
        seedPrompt: story.ai_generation_prompt,
        previousChapters: previousChapters.reverse(),
      });

      const last = await env.DB.prepare(
        "SELECT MAX(chapter_number) as max FROM chapters WHERE story_id = ?"
      )
        .bind(story.id)
        .first<{ max: number | null }>();
      const nextNumber = (last?.max ?? 0) + 1;

      await env.DB.prepare(
        `INSERT INTO chapters (story_id, chapter_number, title, content, generated_by)
         VALUES (?, ?, ?, ?, 'ai')`
      )
        .bind(story.id, nextNumber, generated.title, generated.content)
        .run();
    } catch (err) {
      // Log and continue — one story's AI failure shouldn't skip the rest.
      console.error(`Chapter generation failed for story ${story.id} (${story.title}):`, err);
    }
  }
}
