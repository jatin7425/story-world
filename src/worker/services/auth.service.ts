import type { AuthUser, Env, Gender } from "../types";
import type { IUsersRepository } from "../repositories/users.repository";
import type { ISessionsRepository } from "../repositories/sessions.repository";
import type { IMagicLinkRepository } from "../repositories/magic-link.repository";
import type { IRestrictionsRepository } from "../repositories/restrictions.repository";
import type { UserRow } from "../repositories/types";
import { hashPassword, verifyPassword, randomToken } from "../lib/auth";
import { sendMagicLinkEmail } from "../lib/email";
import { SESSION_TTL_MS } from "../lib/session-cookie";
import { toAuthUser, randomAvatarGender, randomAvatarSeed, isGender } from "../lib/avatar";

const MAGIC_LINK_TTL_MS = 15 * 60 * 1000; // 15 minutes

export interface SignupInput {
  email: string;
  password: string;
  username?: string | null;
  mobile?: string | null;
  gender?: string | null;
}

export type AuthResult = { user: AuthUser; sessionToken: string } | { error: string; status: 400 | 401 | 403 | 409 };

const SUSPENDED_ERROR = "This account has been suspended";

/**
 * Owns every path that can end in a valid session: magic link, password
 * signup, and password login. Kept as one service (rather than one per
 * flow) because they all funnel through the same session-issuing step and
 * share the "does this email already have an account" question.
 */
export class AuthService {
  constructor(
    private readonly users: IUsersRepository,
    private readonly sessions: ISessionsRepository,
    private readonly magicLinks: IMagicLinkRepository,
    private readonly restrictions: IRestrictionsRepository,
    private readonly env: Env
  ) {}

  async requestMagicLink(email: string, appUrl: string): Promise<void> {
    const token = randomToken();
    const expiresAt = new Date(Date.now() + MAGIC_LINK_TTL_MS).toISOString();
    await this.magicLinks.create(token, email, expiresAt);
    await sendMagicLinkEmail(this.env, appUrl, email, token);
  }

  /** Returns null for an invalid/expired/used token, or for a banned account (never issues it a session). */
  async verifyMagicLink(token: string): Promise<string | null> {
    const email = await this.magicLinks.consume(token);
    if (!email) return null;
    const user = await this.users.findOrCreateByEmail(email, randomAvatarGender(), randomAvatarSeed());
    if (await this.restrictions.has(user.id, "banned")) return null;
    return this.createSessionToken(user.id);
  }

  async signup(input: SignupInput): Promise<AuthResult> {
    if (input.password.length < 8) return { error: "Password must be at least 8 characters", status: 400 };

    const genderInput = input.gender ?? null;
    if (genderInput !== null && !isGender(genderInput)) return { error: "Invalid gender value", status: 400 };
    const gender = genderInput as Gender | null;

    if (input.username) {
      const taken = await this.users.findByUsername(input.username);
      if (taken) return { error: "Username is already taken", status: 409 };
    }

    const passwordHash = await hashPassword(input.password);
    const existing = await this.users.findByEmail(input.email);

    let user: UserRow;
    if (existing) {
      if (existing.password_hash) return { error: "An account with this email already exists", status: 409 };
      user = await this.users.attachPassword(existing.id, {
        email: input.email,
        passwordHash,
        username: input.username ?? null,
        mobile: input.mobile ?? null,
        gender,
        avatarGender: existing.avatar_gender,
        avatarSeed: existing.avatar_seed,
      });
    } else {
      user = await this.users.createWithPassword({
        email: input.email,
        passwordHash,
        username: input.username ?? null,
        mobile: input.mobile ?? null,
        gender,
        avatarGender: randomAvatarGender(),
        avatarSeed: randomAvatarSeed(),
      });
    }

    if (await this.restrictions.has(user.id, "banned")) return { error: SUSPENDED_ERROR, status: 403 };

    const sessionToken = await this.createSessionToken(user.id);
    return { user: toAuthUser(user), sessionToken };
  }

  async login(email: string, password: string): Promise<AuthResult> {
    const user = await this.users.findByEmail(email);
    if (!user || !user.password_hash || !(await verifyPassword(password, user.password_hash))) {
      return { error: "Invalid email or password", status: 401 };
    }
    if (await this.restrictions.has(user.id, "banned")) return { error: SUSPENDED_ERROR, status: 403 };

    const sessionToken = await this.createSessionToken(user.id);
    return { user: toAuthUser(user), sessionToken };
  }

  getCurrentUser(sessionToken: string | null): Promise<AuthUser | null> {
    if (!sessionToken) return Promise.resolve(null);
    return this.sessions.findActiveUserByToken(sessionToken);
  }

  private async createSessionToken(userId: number): Promise<string> {
    const token = randomToken();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
    await this.sessions.create(token, userId, expiresAt);
    return token;
  }
}
