// Numbered key slots (rather than a single comma-separated secret) so each
// key can be set independently via `wrangler secret put GROQ_API_KEY_1` — the
// AI provider chain (see lib/ai-providers.ts, used for age-rating
// classification) discovers however many of these are actually set rather
// than assuming a fixed count.
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

export interface AuthUser {
  id: number;
  email: string;
  username: string | null;
  display_name: string | null;
  role: "reader" | "author" | "admin";
  gender: Gender | null;
  avatar_url: string;
  birthdate: string | null;
  created_at: string;
}
