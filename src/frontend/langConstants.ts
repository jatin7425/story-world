import type { Lang } from "./api";

export type { Lang };

/** Every language the reader-facing UI can be shown in, including English. */
export const ALL_LANGS: Lang[] = ["en", "hi", "hinglish", "ja", "ko"];

/** Languages an admin can translate content INTO — excludes English, the source language. */
export const TRANSLATABLE_LANGS: Lang[] = ["hi", "hinglish", "ja", "ko"];

export const LANG_NAMES: Record<Lang, string> = {
  en: "EN",
  hi: "हिन्दी",
  hinglish: "Hinglish",
  ja: "日本語",
  ko: "한국어",
};

export function isLang(value: string | null | undefined): value is Lang {
  return value === "en" || value === "hi" || value === "hinglish" || value === "ja" || value === "ko";
}
