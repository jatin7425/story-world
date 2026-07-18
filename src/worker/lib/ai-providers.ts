/**
 * General-purpose LLM provider chain — currently used for age-rating
 * classification only (see services/age-rating.service.ts). Translation no
 * longer uses this; it calls Google Translate directly (lib/google-translate.ts).
 */

const MAX_OUTPUT_CHARS = 2_000;

/** Thrown when a provider refuses on content-policy/safety grounds rather than a quota/network/generic error — the only failure reason that unlocks the Aion fallback. */
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

export interface AiProvider {
  name: string;
  /** Throws (Error or PolicyRefusalError) on total failure. */
  complete(systemPrompt: string, userText: string): Promise<string>;
}

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

// 70B, not the smaller/cheaper 8B — age-rating classification is
// admin-triggered and low-volume (once per story, not once per reader
// request the way translation used to be), so the larger model's higher
// neuron cost against the free daily Workers AI allowance isn't a real
// concern here the way it was for translation.
const WORKERS_AI_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast" as const;

export class WorkersAiProvider implements AiProvider {
  name = "workers-ai";
  constructor(private readonly ai: Ai) {}

  async complete(systemPrompt: string, userText: string): Promise<string> {
    const result = await this.ai.run(WORKERS_AI_MODEL, {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userText },
      ],
      max_tokens: 512,
      temperature: 0.2,
    });
    const text = (result as { response?: string }).response?.trim();
    if (!text) throw new Error("Workers AI returned an empty response");
    if (looksLikeRefusal(text)) throw new PolicyRefusalError(text.slice(0, 300));
    return truncateOutput(text);
  }
}

const GROQ_MODEL = "llama-3.3-70b-versatile";

export class GroqProvider implements AiProvider {
  name = "groq";
  constructor(private readonly apiKeys: string[]) {}

  async complete(systemPrompt: string, userText: string): Promise<string> {
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
            temperature: 0.2,
            max_tokens: 512,
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

const GEMINI_MODEL = "gemini-2.5-pro"; // Pro tier, not Flash — matches the "70B and above" bar on the other providers

export class GeminiProvider implements AiProvider {
  name = "gemini";
  constructor(private readonly apiKeys: string[]) {}

  async complete(systemPrompt: string, userText: string): Promise<string> {
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
              generationConfig: { temperature: 0.2, maxOutputTokens: 512 },
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
// refused on policy/safety grounds — mature-content classification is
// exactly the case where a safety-conscious model might refuse to even
// analyze the text. Endpoint/model here are a best-effort guess at Aion's
// OpenAI-compatible API shape — verify against their actual docs.
const AION_BASE_URL = "https://api.aionlabs.ai/v1/chat/completions";
const AION_MODEL = "aion-1.0";

export class AionProvider implements AiProvider {
  name = "aion";
  constructor(private readonly apiKeys: string[]) {}

  async complete(systemPrompt: string, userText: string): Promise<string> {
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
            temperature: 0.2,
            max_tokens: 512,
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

/** Runs providers in order, first success wins; `aion` is only tried if an earlier provider hit a PolicyRefusalError. */
export async function callViaProviders(
  providers: AiProvider[],
  systemPrompt: string,
  text: string,
  aion?: AiProvider
): Promise<ProviderResult> {
  const attempts: ProviderAttempt[] = [];
  let sawPolicyRefusal = false;

  for (const provider of providers) {
    try {
      const result = await provider.complete(systemPrompt, text);
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
      const result = await aion.complete(systemPrompt, text);
      attempts.push({ provider: aion.name, ok: true });
      return { text: result, provider: aion.name, attempts };
    } catch (err) {
      attempts.push({ provider: aion.name, ok: false, error: err instanceof Error ? err.message : String(err), reason: "other" });
    }
  }

  const summary = attempts.map((a) => `${a.provider}: ${a.ok ? "ok" : a.error}`).join(" | ");
  throw new Error(`All AI providers failed — ${summary}`);
}

function classifyError(err: unknown): ProviderAttempt["reason"] {
  const message = err instanceof Error ? err.message.toLowerCase() : "";
  if (message.includes("rate limited") || message.includes("429") || message.includes("quota")) return "quota";
  if (message.includes("fetch") || message.includes("network")) return "network";
  return "other";
}
