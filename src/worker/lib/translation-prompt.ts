import type { SupportedLang, Lang } from "../types";

export type { SupportedLang, Lang };

export const SUPPORTED_LANGS: SupportedLang[] = ["hi", "ja", "ko", "hinglish"];
export const ALL_LANGS: Lang[] = ["en", "hi", "ja", "ko", "hinglish"];

export const TARGET_LANGUAGE_NAMES: Record<SupportedLang, string> = {
  hi: "Hindi",
  ja: "Japanese",
  ko: "Korean",
  hinglish: "Hinglish",
};

export function isSupportedLang(value: unknown): value is SupportedLang {
  return value === "hi" || value === "ja" || value === "ko" || value === "hinglish";
}

export function isLang(value: unknown): value is Lang {
  return value === "en" || isSupportedLang(value);
}

const HINGLISH_STYLE = `You are a skilled bilingual writer producing natural "Hinglish" — the way urban Indian readers actually text and speak: Hindi and English code-switched fluently within the same sentences, written in the Latin/Roman alphabet, NOT Devanagari script. Lean noticeably more English than Hindi: use English for most nouns, verbs, and everyday phrasing, and weave in Hindi words/connectors (jaise "kyunki", "lekin", "uske baad", "bahut", "yaar", "matlab") the way a casual Indian English speaker would text a friend. Do NOT write pure/formal Hindi — that defeats the point. Do NOT write in Devanagari script at all.`;

/**
 * Literary-translation system prompt — deliberately NOT a "translate this
 * literally" instruction. The product requirement (stated explicitly, more
 * than once) is that this reads like a fluent, engaging translation a human
 * novelist would produce, not word-for-word machine translation.
 */
export function buildLiteraryPrompt(targetLang: SupportedLang): string {
  const opening = targetLang === "hinglish" ? HINGLISH_STYLE : `You are an award-winning literary translator working from English into ${TARGET_LANGUAGE_NAMES[targetLang]}.`;
  const styleLine =
    targetLang === "hinglish"
      ? "Translate the user's text into that Hinglish style — natural, engaging prose, not a literal word-for-word translation."
      : `Translate the user's text so it reads as if it were originally written in ${TARGET_LANGUAGE_NAMES[targetLang]} by a skilled novelist — natural, idiomatic, emotionally engaging prose. Do NOT produce a literal word-for-word translation.`;
  return `${opening}
${styleLine}
Preserve: narrative tone and register, character voice and dialogue style, humor, tension, and pacing.
Adapt idioms, metaphors and cultural references so they land naturally, without changing plot facts, character names, place names, or numbers.
Formatting rule (critical): output must preserve the exact paragraph structure of the input — the same number of paragraphs, in the same order, with nothing added or removed.
Do not add commentary, notes, explanations, disclaimers, or any content not present in the source. Output ONLY the translated text, nothing else.`;
}

/** Lighter variant for short single-field text (currently: story descriptions only — chapter/story titles are deliberately left untranslated, see TranslationJobService). */
export function buildShortTextPrompt(targetLang: SupportedLang): string {
  const opening = targetLang === "hinglish" ? HINGLISH_STYLE : `You are an award-winning literary translator working from English into ${TARGET_LANGUAGE_NAMES[targetLang]}.`;
  const styleLine =
    targetLang === "hinglish"
      ? "Translate the user's text into that Hinglish style — natural and engaging, not a literal word-for-word translation."
      : `Translate the user's text so it reads as if it were originally written in ${TARGET_LANGUAGE_NAMES[targetLang]} — natural, idiomatic, engaging, not a literal word-for-word translation.`;
  return `${opening}
${styleLine} Preserve tone and don't change names, places, or numbers.
Output ONLY the translated text, nothing else — no commentary, no quotation marks around it, no notes.`;
}
