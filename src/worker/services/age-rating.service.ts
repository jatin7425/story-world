import type { IStoriesRepository } from "../repositories/stories.repository";
import type { IChaptersRepository } from "../repositories/chapters.repository";
import type { AiProvider } from "../lib/ai-providers";
import { callViaProviders } from "../lib/ai-providers";
import type { AgeRating, StoryRow } from "../repositories/types";

const VALID_RATINGS: AgeRating[] = ["all", "13+", "16+", "18+"];

const SYSTEM_PROMPT = `You are a content-rating classifier for a fiction reading platform. Read the story's description and opening chapter text, then classify its age-appropriateness.

Respond with EXACTLY this format, nothing else:
RATING: <all|13+|16+|18+>
REASON: <one short sentence>

Rating guide:
- "all": suitable for any age — no violence, no sexual content, no strong language.
- "13+": mild violence, mild language, romance without explicit detail — typical YA content.
- "16+": moderate violence, intense themes, suggestive content, strong language.
- "18+": graphic violence, explicit sexual content, or other clearly adult material.

Be direct and honest about mature content — this classification exists for reader disclosure, not censorship. Do not refuse to classify dark, violent, or mature fiction; accurately labeling exactly that kind of content is the whole point of this task.`;

function parseRatingResponse(text: string): { rating: AgeRating; reason: string } | null {
  const ratingLine = text.match(/RATING:\s*([^\n]+)/i)?.[1]?.trim().toLowerCase();
  const reason = text.match(/REASON:\s*([^\n]+)/i)?.[1]?.trim() ?? "";
  const rating = VALID_RATINGS.find((r) => r.toLowerCase() === ratingLine);
  return rating ? { rating, reason } : null;
}

/**
 * AI-assisted age-rating classification, admin-triggered per story. Reuses
 * the same provider chain (Workers AI -> Groq -> Gemini, Aion as a
 * policy-refusal fallback) that used to serve translation, before
 * translation moved to Google Translate. Purely informational — the site
 * doesn't collect reader age, so this is a disclosed badge, not an access
 * gate.
 */
export class AgeRatingService {
  constructor(
    private readonly stories: IStoriesRepository,
    private readonly chapters: IChaptersRepository,
    private readonly providers: AiProvider[],
    private readonly aion: AiProvider | undefined
  ) {}

  async classifyStory(storyId: number): Promise<StoryRow> {
    const story = await this.stories.findById(storyId);
    if (!story) throw new Error("Story not found");

    const chapters = await this.chapters.listFullByStory(storyId);
    const firstChapter = chapters.find((c) => c.status === "published") ?? chapters[0];
    const excerpt = firstChapter ? firstChapter.content.slice(0, 3000) : "";

    const userText = `Title: ${story.title}\nDescription: ${story.description ?? "(none)"}\n\nOpening chapter excerpt:\n${excerpt || "(no chapters yet)"}`;

    // Occasional degenerate/garbled output happens even from a good model
    // (observed directly with the 70B-fast Workers AI variant) — a couple of
    // quick retries clears it up almost always, cheaper than making the
    // admin manually click the button again for what's usually a one-off.
    let parsed: { rating: AgeRating; reason: string } | null = null;
    let lastRawText = "";
    for (let attempt = 0; attempt < 3 && !parsed; attempt++) {
      const result = await callViaProviders(this.providers, SYSTEM_PROMPT, userText, this.aion);
      lastRawText = result.text;
      parsed = parseRatingResponse(result.text);
    }
    if (!parsed) throw new Error(`Could not parse a rating from the AI response after 3 attempts: "${lastRawText.slice(0, 200)}"`);

    const updated = await this.stories.updateAgeRating(storyId, parsed.rating, parsed.reason || null, "ai");
    if (!updated) throw new Error("Story not found");
    return updated;
  }

  async setManualRating(storyId: number, rating: AgeRating): Promise<StoryRow> {
    const updated = await this.stories.updateAgeRating(storyId, rating, null, "admin");
    if (!updated) throw new Error("Story not found");
    return updated;
  }
}
