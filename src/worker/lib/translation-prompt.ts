export type SupportedLang = "hi" | "ja" | "ko";
export const SUPPORTED_LANGS: SupportedLang[] = ["hi", "ja", "ko"];

export type Lang = "en" | SupportedLang;
export const ALL_LANGS: Lang[] = ["en", "hi", "ja", "ko"];

export const TARGET_LANGUAGE_NAMES: Record<SupportedLang, string> = {
  hi: "Hindi",
  ja: "Japanese",
  ko: "Korean",
};

export function isSupportedLang(value: unknown): value is SupportedLang {
  return value === "hi" || value === "ja" || value === "ko";
}

export function isLang(value: unknown): value is Lang {
  return value === "en" || isSupportedLang(value);
}

/**
 * Literary-translation system prompt — deliberately NOT a "translate this
 * literally" instruction. The product requirement (stated explicitly, more
 * than once) is that this reads like a fluent, engaging translation a human
 * novelist would produce, not word-for-word machine translation.
 */
export function buildLiteraryPrompt(targetLang: SupportedLang): string {
  const name = TARGET_LANGUAGE_NAMES[targetLang];
  return `You are an award-winning literary translator working from English into ${name}.
Translate the user's text so it reads as if it were originally written in ${name} by a skilled novelist — natural, idiomatic, emotionally engaging prose. Do NOT produce a literal word-for-word translation.
Preserve: narrative tone and register, character voice and dialogue style, humor, tension, and pacing.
Adapt idioms, metaphors and cultural references so they land naturally for a ${name}-reading audience, without changing plot facts, character names, place names, or numbers.
Formatting rule (critical): output must preserve the exact paragraph structure of the input — the same number of paragraphs, in the same order, with nothing added or removed.
Do not add commentary, notes, explanations, disclaimers, or any content not present in the source. Output ONLY the translated text, nothing else.`;
}

/** Lighter variant for short single-field text (titles, story descriptions) — no paragraph-structure rule needed. */
export function buildShortTextPrompt(targetLang: SupportedLang): string {
  const name = TARGET_LANGUAGE_NAMES[targetLang];
  return `You are an award-winning literary translator working from English into ${name}.
Translate the user's text so it reads as if it were originally written in ${name} — natural, idiomatic, engaging, not a literal word-for-word translation. Preserve tone and don't change names, places, or numbers.
Output ONLY the translated text, nothing else — no commentary, no quotation marks around it, no notes.`;
}
