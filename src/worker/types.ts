// Numbered key slots (rather than a single comma-separated secret) so each
// key can be set independently via `wrangler secret put GROQ_API_KEY_1` — the
// translation provider chain (see lib/translation-providers.ts) discovers
// however many of these are actually set rather than assuming a fixed count.
type NumberedKeySlots<Prefix extends string> = {
  [K in `${Prefix}_${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10}`]?: string;
};

export interface Env
  extends NumberedKeySlots<"GROQ_API_KEY">,
    NumberedKeySlots<"GEMINI_API_KEY">,
    NumberedKeySlots<"AION_API_KEY"> {
  DB: D1Database;
  ASSETS: Fetcher;
  AI: Ai;
  RESEND_API_KEY?: string;
  SESSION_SECRET?: string;
}

export type Gender = "male" | "female" | "other";
export type AvatarGender = "male" | "female";
export type SupportedLang = "hi" | "ja" | "ko" | "hinglish";
export type Lang = "en" | SupportedLang;

export interface AuthUser {
  id: number;
  email: string;
  display_name: string | null;
  role: "reader" | "author" | "admin";
  gender: Gender | null;
  avatar_url: string;
  preferred_lang: Lang | null;
  secondary_lang: Lang | null;
}
