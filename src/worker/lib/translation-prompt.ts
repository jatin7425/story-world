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

const HINGLISH_STYLE = `You are a professional Hinglish copywriter. In this context, "Hinglish" means: write the translation in DEVANAGARI SCRIPT with standard, correct Hindi grammar and sentence structure — exactly like a normal Hindi translation — EXCEPT that a select number of individual words are swapped for their English equivalent, written in Latin/Roman script inline within the Devanagari sentence. The sentence structure, word order, pronouns, verbs, and the great majority of vocabulary all stay proper Devanagari Hindi. Only specific words switch to English — typically emotionally-loaded words, modern/casual terms, character-role words, or words that land harder in English (e.g. "fail", "stress", "villain", "strong", "cool", "boring", "awesome", "attitude").

This is NOT the Roman-script code-mixed style sometimes also called "Hinglish" — do not write the whole sentence in Latin letters. The base script is Devanagari.

Illustrative example (this shows the STYLE ONLY — do NOT reuse its grammar, sentence shape, or specific words for unrelated content; every sentence you translate must be built fresh from its own source meaning):
Pure Hindi: "वो अपने पिता को बचाने की कोशिश कर रहा था लेकिन असफल रहा क्योंकि खलनायक इस ताकत के मुकाबले करने या बराबरी करने के लिए बहुत मजबूत था।"
Hinglish (target style): "वो अपने पिता को बचाने की कोशिश कर रहा था लेकिन fail हो गया क्योंकि villain की ताकत, मुकाबले करने या बराबरी करने के लिए बहुत strong था।"
Notice only three words changed ("असफल रहा"→"fail हो गया", "खलनायक"→"villain", "मजबूत"→"strong") — that ratio of change is the target, not this sentence's specific wording or grammatical shape.

Rules:
1. Write primarily in Devanagari script. English words are the exception, inserted inline, not the rule.
2. Keep standard Hindi grammar and sentence structure throughout — translate as if doing a normal, correct Hindi translation of THIS source sentence first, then swap in a modest number of English words. Never reuse a stock sentence pattern from the example above for different content.
3. Do not swap so many words that the sentence stops reading as Hindi. Most of each sentence must remain Devanagari.
4. Favor swapping: emotion/state words, character-role nouns, modern/tech terms, and punchy adjectives — not pronouns, basic verbs, or grammatical particles.
5. MANDATORY MINIMUM: every paragraph you output MUST contain at least one, usually two or three, English words written in Latin script inline. A paragraph translated into pure, unmixed Devanagari Hindi with zero English words has FAILED this task. If there's no obvious "modern/emotional" word to swap, pick the closest candidate anyway rather than outputting zero English words.
6. GRAMMATICAL CORRECTNESS IS MANDATORY. The Hindi surrounding the English word(s) must be completely correct: verb/adjective gender and number agreement, correct case markers, no repeated/tautological phrasing (e.g. never say a Hindi word and its English synonym back to back, like ताकत ... strong together — pick one). Do not invent nonsense verb conjugations. If you are not confident a sentence is grammatically correct, simplify it rather than force a broken construction.
7. FIDELITY: translate the actual content of the source — the same objects, animals, actions, and facts. Never substitute a different noun/animal/object than what the source says (e.g. if the source says bees, the translation must also say bees, not some other animal).`;

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
