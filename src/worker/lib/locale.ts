import type { SupportedLang } from "./translation-prompt";

const COUNTRY_LANG_MAP: Record<string, SupportedLang> = {
  IN: "hi",
  JP: "ja",
  KR: "ko",
};

/** `country` is Cloudflare's free `request.cf.country` (ISO 3166-1 alpha-2), or null if unavailable (e.g. local dev). */
export function suggestLangForCountry(country: string | null | undefined): "en" | SupportedLang {
  if (!country) return "en";
  return COUNTRY_LANG_MAP[country] ?? "en";
}
