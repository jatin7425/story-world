import type { AuthUser, Gender, AvatarGender } from "../types";
import { isLang } from "./translation-prompt";

export function isGender(value: unknown): value is Gender {
  return value === "male" || value === "female" || value === "other";
}

export function randomAvatarGender(): AvatarGender {
  return Math.random() < 0.5 ? "male" : "female";
}

export function randomAvatarSeed(): number {
  return Math.floor(Math.random() * 100);
}

/**
 * Uses the user's stated gender when set; otherwise falls back to the
 * randomly pre-assigned avatar_gender bucket so an avatar is always
 * available. Backed by randomuser.me's static portrait set: men/women have
 * indices 0-99, the neutral "lego" set (used for 'other') only 0-9.
 */
export function resolveAvatarUrl(gender: Gender | null, avatarGender: AvatarGender, seed: number): string {
  const bucket = gender ?? avatarGender;
  if (bucket === "other") {
    return `https://randomuser.me/api/portraits/lego/${seed % 10}.jpg`;
  }
  const path = bucket === "male" ? "men" : "women";
  return `https://randomuser.me/api/portraits/${path}/${seed % 100}.jpg`;
}

export interface AuthUserRow {
  id: number;
  email: string;
  display_name: string | null;
  role: AuthUser["role"];
  gender: Gender | null;
  avatar_gender: AvatarGender;
  avatar_seed: number;
  preferred_lang: string | null;
  secondary_lang: string | null;
}

export function toAuthUser(row: AuthUserRow): AuthUser {
  return {
    id: row.id,
    email: row.email,
    display_name: row.display_name,
    role: row.role,
    gender: row.gender,
    avatar_url: resolveAvatarUrl(row.gender, row.avatar_gender, row.avatar_seed),
    preferred_lang: isLang(row.preferred_lang) ? row.preferred_lang : null,
    secondary_lang: isLang(row.secondary_lang) ? row.secondary_lang : null,
  };
}
