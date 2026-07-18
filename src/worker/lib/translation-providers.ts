/**
 * D1 rejects a single column value beyond ~1MB (SQLITE_TOOBIG) — see
 * images.repository.ts for the same constraint on image blobs. Translation
 * output is plain text, far smaller, but we still cap what we'll accept from
 * a provider defensively.
 */
const MAX_OUTPUT_CHARS = 200_000;

/** Thrown specifically when a provider refuses on content-policy/safety
 * grounds (as opposed to a quota, network, or generic error) — this is the
 * ONLY failure reason that unlocks the Aion fallback (see translateViaProviders). */
export class PolicyRefusalError extends Error {}

export interface ProviderAttempt {
  provider: string;
  ok: boolean;
  error?: string;
  reason?: "policy" | "quota" | "network" | "other";
}

export interface ProviderResult {
  text: string;
  provider: string;
  attempts: ProviderAttempt[];
}

export interface TranslationProvider {
  name: string;
  /** Throws (Error or PolicyRefusalError) on total failure for this provider. */
  translate(systemPrompt: string, userText: string): Promise<string>;
}

// A handful of stock refusal openers that show up across providers when a
// model declines on safety/policy grounds rather than actually translating.
// Used as a fallback signal alongside each provider's structured
// finish_reason/blockReason field, since not every provider exposes one
// reliably through every response shape.
const REFUSAL_PATTERNS = [
  /^i('m| am) (sorry|unable)/i,
  /^i can('t|not)/i,
  /^i('m| am) not able to/i,
  /as an ai( language model)?,? i/i,
  /cannot (assist|help|comply) with/i,
  /against (my|our) (usage )?polic/i,
  /content policy/i,
];

function looksLikeRefusal(text: string): boolean {
  const head = text.slice(0, 200).trim();
  return REFUSAL_PATTERNS.some((re) => re.test(head));
}

function truncateOutput(text: string): string {
  return text.length > MAX_OUTPUT_CHARS ? text.slice(0, MAX_OUTPUT_CHARS) : text;
}

const TRANSLATION_MODEL = "@cf/meta/llama-3.1-8b-instruct-fp8" as const;

export class WorkersAiProvider implements TranslationProvider {
  name = "workers-ai";
  constructor(private readonly ai: Ai) {}

  async translate(systemPrompt: string, userText: string): Promise<string> {
    const result = await this.ai.run(TRANSLATION_MODEL, {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userText },
      ],
      max_tokens: 4096,
      temperature: 0.4,
    });
    const text = (result as { response?: string }).response?.trim();
    if (!text) throw new Error("Workers AI returned an empty response");
    if (looksLikeRefusal(text)) throw new PolicyRefusalError(text.slice(0, 300));
    return truncateOutput(text);
  }
}

const GROQ_MODEL = "llama-3.3-70b-versatile";

export class GroqProvider implements TranslationProvider {
  name = "groq";
  constructor(private readonly apiKeys: string[]) {}

  async translate(systemPrompt: string, userText: string): Promise<string> {
    if (this.apiKeys.length === 0) throw new Error("No Groq API keys configured");

    let lastError: Error = new Error("Groq: no keys attempted");
    for (let i = 0; i < this.apiKeys.length; i++) {
      const key = this.apiKeys[i];
      try {
        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: GROQ_MODEL,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userText },
            ],
            temperature: 0.4,
            max_tokens: 4096,
          }),
        });

        if (res.status === 429) {
          lastError = new Error(`key ${i + 1}: rate limited (429)`);
          continue; // next key
        }
        if (!res.ok) {
          const body = await res.text().catch(() => "");
          lastError = new Error(`key ${i + 1}: HTTP ${res.status} ${body.slice(0, 200)}`);
          continue;
        }

        const data = (await res.json()) as {
          choices?: { message?: { content?: string }; finish_reason?: string }[];
        };
        const choice = data.choices?.[0];
        if (choice?.finish_reason === "content_filter") {
          throw new PolicyRefusalError(`Groq key ${i + 1}: content_filter`);
        }
        const text = choice?.message?.content?.trim();
        if (!text) {
          lastError = new Error(`key ${i + 1}: empty response`);
          continue;
        }
        if (looksLikeRefusal(text)) throw new PolicyRefusalError(text.slice(0, 300));
        return truncateOutput(text);
      } catch (err) {
        if (err instanceof PolicyRefusalError) throw err;
        lastError = err instanceof Error ? err : new Error(String(err));
      }
    }
    throw lastError;
  }
}

const GEMINI_MODEL = "gemini-2.0-flash";

export class GeminiProvider implements TranslationProvider {
  name = "gemini";
  constructor(private readonly apiKeys: string[]) {}

  async translate(systemPrompt: string, userText: string): Promise<string> {
    if (this.apiKeys.length === 0) throw new Error("No Gemini API keys configured");

    let lastError: Error = new Error("Gemini: no keys attempted");
    for (let i = 0; i < this.apiKeys.length; i++) {
      const key = this.apiKeys[i];
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(key)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: systemPrompt }] },
              contents: [{ role: "user", parts: [{ text: userText }] }],
              generationConfig: { temperature: 0.4, maxOutputTokens: 4096 },
            }),
          }
        );

        if (res.status === 429) {
          lastError = new Error(`key ${i + 1}: rate limited (429)`);
          continue;
        }
        if (!res.ok) {
          const body = await res.text().catch(() => "");
          lastError = new Error(`key ${i + 1}: HTTP ${res.status} ${body.slice(0, 200)}`);
          continue;
        }

        const data = (await res.json()) as {
          promptFeedback?: { blockReason?: string };
          candidates?: { finishReason?: string; content?: { parts?: { text?: string }[] } }[];
        };
        if (data.promptFeedback?.blockReason) {
          throw new PolicyRefusalError(`Gemini key ${i + 1}: blocked (${data.promptFeedback.blockReason})`);
        }
        const candidate = data.candidates?.[0];
        if (candidate?.finishReason === "SAFETY") {
          throw new PolicyRefusalError(`Gemini key ${i + 1}: finishReason SAFETY`);
        }
        const text = candidate?.content?.parts?.map((p) => p.text ?? "").join("").trim();
        if (!text) {
          lastError = new Error(`key ${i + 1}: empty response`);
          continue;
        }
        if (looksLikeRefusal(text)) throw new PolicyRefusalError(text.slice(0, 300));
        return truncateOutput(text);
      } catch (err) {
        if (err instanceof PolicyRefusalError) throw err;
        lastError = err instanceof Error ? err : new Error(String(err));
      }
    }
    throw lastError;
  }
}

// Aion is a last-resort fallback only ever reached when an earlier provider
// (Workers AI/Groq/Gemini) refused on policy/safety grounds — see
// translateViaProviders. Its API shape here follows the OpenAI-compatible
// chat-completions convention most third-party inference providers expose,
// which is a best-effort guess: verify the base URL/model id/payload shape
// against Aion's actual docs before relying on this in production, and
// adjust the endpoint/model constants below if they differ.
const AION_BASE_URL = "https://api.aionlabs.ai/v1/chat/completions";
const AION_MODEL = "aion-1.0";

export class AionProvider implements TranslationProvider {
  name = "aion";
  constructor(private readonly apiKeys: string[]) {}

  async translate(systemPrompt: string, userText: string): Promise<string> {
    if (this.apiKeys.length === 0) throw new Error("No Aion API keys configured");

    let lastError: Error = new Error("Aion: no keys attempted");
    for (let i = 0; i < this.apiKeys.length; i++) {
      const key = this.apiKeys[i];
      try {
        const res = await fetch(AION_BASE_URL, {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: AION_MODEL,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userText },
            ],
            temperature: 0.4,
            max_tokens: 4096,
          }),
        });

        if (res.status === 429) {
          lastError = new Error(`key ${i + 1}: rate limited (429)`);
          continue;
        }
        if (!res.ok) {
          const body = await res.text().catch(() => "");
          lastError = new Error(`key ${i + 1}: HTTP ${res.status} ${body.slice(0, 200)}`);
          continue;
        }

        const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
        const text = data.choices?.[0]?.message?.content?.trim();
        if (!text) {
          lastError = new Error(`key ${i + 1}: empty response`);
          continue;
        }
        return truncateOutput(text);
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
      }
    }
    throw lastError;
  }
}

/**
 * Runs the provider chain in order (normally [WorkersAI, Groq, Gemini]),
 * first success wins. `aion`, if configured, is invoked ONLY when at least
 * one of the earlier providers failed specifically with a PolicyRefusalError
 * — it's a targeted escape valve for content a mainstream model refuses on
 * safety grounds (this platform carries dark-fantasy/horror-tagged fiction
 * that can trip generic safety filters despite being legitimate content),
 * not a general 4th fallback for quota/network failures.
 */
export async function translateViaProviders(
  providers: TranslationProvider[],
  systemPrompt: string,
  text: string,
  aion?: TranslationProvider
): Promise<ProviderResult> {
  const attempts: ProviderAttempt[] = [];
  let sawPolicyRefusal = false;

  for (const provider of providers) {
    try {
      const result = await provider.translate(systemPrompt, text);
      attempts.push({ provider: provider.name, ok: true });
      return { text: result, provider: provider.name, attempts };
    } catch (err) {
      const isPolicy = err instanceof PolicyRefusalError;
      if (isPolicy) sawPolicyRefusal = true;
      attempts.push({
        provider: provider.name,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        reason: isPolicy ? "policy" : classifyError(err),
      });
    }
  }

  if (sawPolicyRefusal && aion) {
    try {
      const result = await aion.translate(systemPrompt, text);
      attempts.push({ provider: aion.name, ok: true });
      return { text: result, provider: aion.name, attempts };
    } catch (err) {
      attempts.push({
        provider: aion.name,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        reason: "other",
      });
    }
  }

  const summary = attempts.map((a) => `${a.provider}: ${a.ok ? "ok" : a.error}`).join(" | ");
  throw new Error(`All translation providers failed — ${summary}`);
}

function classifyError(err: unknown): ProviderAttempt["reason"] {
  const message = err instanceof Error ? err.message.toLowerCase() : "";
  if (message.includes("rate limited") || message.includes("429") || message.includes("quota")) return "quota";
  if (message.includes("fetch") || message.includes("network")) return "network";
  return "other";
}
