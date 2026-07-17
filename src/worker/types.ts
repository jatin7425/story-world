export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  RESEND_API_KEY?: string;
  SESSION_SECRET?: string;
}

export type Gender = "male" | "female" | "other";
export type AvatarGender = "male" | "female";

export interface AuthUser {
  id: number;
  email: string;
  display_name: string | null;
  role: "reader" | "author" | "admin";
  gender: Gender | null;
  avatar_url: string;
}
