import type { IFollowsRepository } from "../repositories/follows.repository";
import type { ICommentsRepository } from "../repositories/comments.repository";
import type { IUsersRepository } from "../repositories/users.repository";
import type { AuthUser } from "../types";
import type { StoryRow, ProfileCommentRow } from "../repositories/types";
import { toAuthUser, randomAvatarSeed, isGender } from "../lib/avatar";
import { toPaginated, type Paginated } from "../lib/pagination";

export interface ProfileData {
  user: AuthUser;
  followedStories: Paginated<Pick<StoryRow, "id" | "title" | "slug" | "cover_image_url">>;
  recentComments: Paginated<ProfileCommentRow>;
}

export class ProfileService {
  constructor(
    private readonly follows: IFollowsRepository,
    private readonly comments: ICommentsRepository,
    private readonly users: IUsersRepository
  ) {}

  async getProfile(
    user: AuthUser,
    followedPage: number,
    commentsPage: number,
    limit: number
  ): Promise<ProfileData> {
    const [followedResult, commentsResult] = await Promise.all([
      this.follows.listStoriesForUser(user.id, limit, (followedPage - 1) * limit),
      this.comments.listRecentForUser(user.id, limit, (commentsPage - 1) * limit),
    ]);
    return {
      user,
      followedStories: toPaginated(followedResult.items, followedResult.total, followedPage, limit),
      recentComments: toPaginated(commentsResult.items, commentsResult.total, commentsPage, limit),
    };
  }

  /**
   * Self-declared age verification: birthdate is set once and never editable
   * afterwards — otherwise an underage reader could simply re-declare an
   * older date after being blocked from a rated story.
   */
  async updateBirthdate(userId: number, birthdate: string): Promise<AuthUser | { error: string }> {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birthdate)) return { error: "Invalid birthdate format" };
    const date = new Date(`${birthdate}T00:00:00Z`);
    const now = new Date();
    if (Number.isNaN(date.getTime()) || birthdate !== date.toISOString().slice(0, 10)) {
      return { error: "Invalid birthdate" };
    }
    if (date > now) return { error: "Birthdate cannot be in the future" };
    if (now.getUTCFullYear() - date.getUTCFullYear() > 120) return { error: "Invalid birthdate" };

    const existing = await this.users.findById(userId);
    if (!existing) return { error: "User not found" };
    if (existing.birthdate) return { error: "Birthdate is already set and cannot be changed" };

    const updated = await this.users.updateBirthdate(userId, birthdate);
    return toAuthUser(updated);
  }

  /** Re-rolls avatar_seed so the picture visibly changes, not just the gender bucket it's drawn from. */
  async updateGender(userId: number, gender: string | null): Promise<AuthUser | { error: string }> {
    if (gender !== null && !isGender(gender)) return { error: "Invalid gender value" };
    const updated = await this.users.updateGender(userId, gender, randomAvatarSeed());
    return toAuthUser(updated);
  }
}
