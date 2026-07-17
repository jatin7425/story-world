import type { IFollowsRepository } from "../repositories/follows.repository";
import type { ICommentsRepository } from "../repositories/comments.repository";
import type { IUsersRepository } from "../repositories/users.repository";
import type { AuthUser } from "../types";
import type { StoryRow, ProfileCommentRow } from "../repositories/types";
import { toAuthUser, randomAvatarSeed, isGender } from "../lib/avatar";

export interface ProfileData {
  user: AuthUser;
  followedStories: Pick<StoryRow, "id" | "title" | "slug" | "cover_image_url">[];
  recentComments: ProfileCommentRow[];
}

export class ProfileService {
  constructor(
    private readonly follows: IFollowsRepository,
    private readonly comments: ICommentsRepository,
    private readonly users: IUsersRepository
  ) {}

  async getProfile(user: AuthUser): Promise<ProfileData> {
    const [followedStories, recentComments] = await Promise.all([
      this.follows.listStoriesForUser(user.id),
      this.comments.listRecentForUser(user.id, 20),
    ]);
    return { user, followedStories, recentComments };
  }

  /** Re-rolls avatar_seed so the picture visibly changes, not just the gender bucket it's drawn from. */
  async updateGender(userId: number, gender: string | null): Promise<AuthUser | { error: string }> {
    if (gender !== null && !isGender(gender)) return { error: "Invalid gender value" };
    const updated = await this.users.updateGender(userId, gender, randomAvatarSeed());
    return toAuthUser(updated);
  }
}
