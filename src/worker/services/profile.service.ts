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

  /** Re-rolls avatar_seed so the picture visibly changes, not just the gender bucket it's drawn from. */
  async updateGender(userId: number, gender: string | null): Promise<AuthUser | { error: string }> {
    if (gender !== null && !isGender(gender)) return { error: "Invalid gender value" };
    const updated = await this.users.updateGender(userId, gender, randomAvatarSeed());
    return toAuthUser(updated);
  }
}
