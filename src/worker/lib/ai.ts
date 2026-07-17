import type { Env } from "../types";

export interface ChapterGenerationInput {
  storyTitle: string;
  storyDescription: string | null;
  seedPrompt: string | null;
  previousChapters: { chapter_number: number; title: string | null; content: string }[];
}

export interface GeneratedChapter {
  title: string;
  content: string;
}

const WORKERS_AI_MODEL = "@cf/meta/llama-3.1-8b-instruct";
const SYSTEM_PROMPT = "You are a skilled fiction writer generating serialized story chapters.";

/**
 * Generates the next chapter using whichever provider is configured via
 * env.AI_PROVIDER (defaults to Cloudflare Workers AI). Callers (the cron job,
 * admin "generate" actions, etc.) never touch a provider directly — swapping
 * or adding a provider only means editing this file.
 */
export async function generateNextChapter(
  env: Env,
  input: ChapterGenerationInput
): Promise<GeneratedChapter> {
  const userPrompt = buildPrompt(input);
  const provider = env.AI_PROVIDER ?? "workers-ai";

  switch (provider) {
    case "litellm":
      return runLiteLLM(env, userPrompt);
    case "workers-ai":
    default:
      return runWorkersAI(env, userPrompt);
  }
}

function buildPrompt(input: ChapterGenerationInput): string {
  const recentContext = input.previousChapters
    .slice(-3)
    .map((c) => `Chapter ${c.chapter_number}${c.title ? `: ${c.title}` : ""}\n${c.content}`)
    .join("\n\n---\n\n");

  return [
    `You are continuing the story "${input.storyTitle}".`,
    input.storyDescription ? `Story description: ${input.storyDescription}` : null,
    input.seedPrompt ? `Style/direction guidance: ${input.seedPrompt}` : null,
    recentContext ? `Recent chapters for context:\n\n${recentContext}` : "This is the first chapter.",
    "Write the next chapter. Respond with the chapter title on the first line, then a blank line, then the chapter body. Do not add any other commentary.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

async function runWorkersAI(env: Env, userPrompt: string): Promise<GeneratedChapter> {
  const result = await env.AI.run(WORKERS_AI_MODEL, {
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
  });

  const raw = (result as { response?: string }).response ?? "";
  return parseChapter(raw);
}

/**
 * Calls any OpenAI-chat-completions-compatible endpoint — this is the shape
 * LiteLLM proxies expose, so pointing LITELLM_BASE_URL at a LiteLLM deployment
 * (or directly at OpenAI/Groq/etc.) works without further changes.
 */
async function runLiteLLM(env: Env, userPrompt: string): Promise<GeneratedChapter> {
  if (!env.LITELLM_BASE_URL) {
    throw new Error("LITELLM_BASE_URL is not set but AI_PROVIDER is 'litellm'.");
  }

  const res = await fetch(`${env.LITELLM_BASE_URL.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(env.LITELLM_API_KEY ? { Authorization: `Bearer ${env.LITELLM_API_KEY}` } : {}),
    },
    body: JSON.stringify({
      model: env.LITELLM_MODEL ?? "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`LiteLLM request failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json<{ choices?: { message?: { content?: string } }[] }>();
  const raw = data.choices?.[0]?.message?.content ?? "";
  return parseChapter(raw);
}

function parseChapter(raw: string): GeneratedChapter {
  const trimmed = raw.trim();
  const [firstLine, ...rest] = trimmed.split("\n");
  const body = rest.join("\n").trim();

  if (!body) {
    // Model didn't follow the title/blank-line/body format — treat it all as body.
    return { title: "Untitled Chapter", content: trimmed };
  }

  return { title: firstLine.replace(/^#+\s*/, "").trim() || "Untitled Chapter", content: body };
}
