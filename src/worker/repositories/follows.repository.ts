import type { StoryRow } from "./types";

type FollowedStory = Pick<StoryRow, "id" | "title" | "slug" | "cover_image_url">;

export interface FollowedStoryPage {
  items: FollowedStory[];
  total: number;
}

export interface IFollowsRepository {
  countForStory(storyId: number): Promise<number>;
  isFollowing(userId: number, storyId: number): Promise<boolean>;
  follow(userId: number, storyId: number): Promise<void>;
  unfollow(userId: number, storyId: number): Promise<void>;
  listStoriesForUser(userId: number, limit: number, offset: number): Promise<FollowedStoryPage>;
  deleteForStory(storyId: number): Promise<void>;
}

export class FollowsRepository implements IFollowsRepository {
  constructor(private readonly db: D1Database) {}

  async countForStory(storyId: number): Promise<number> {
    const row = await this.db
      .prepare("SELECT COUNT(*) as count FROM follows WHERE story_id = ?")
      .bind(storyId)
      .first<{ count: number }>();
    return row?.count ?? 0;
  }

  async isFollowing(userId: number, storyId: number): Promise<boolean> {
    const row = await this.db
      .prepare("SELECT 1 FROM follows WHERE user_id = ? AND story_id = ?")
      .bind(userId, storyId)
      .first();
    return !!row;
  }

  async follow(userId: number, storyId: number): Promise<void> {
    await this.db
      .prepare("INSERT OR IGNORE INTO follows (user_id, story_id) VALUES (?, ?)")
      .bind(userId, storyId)
      .run();
  }

  async unfollow(userId: number, storyId: number): Promise<void> {
    await this.db.prepare("DELETE FROM follows WHERE user_id = ? AND story_id = ?").bind(userId, storyId).run();
  }

  async listStoriesForUser(userId: number, limit: number, offset: number): Promise<FollowedStoryPage> {
    const [{ results }, countRow] = await Promise.all([
      this.db
        .prepare(
          `SELECT s.id, s.title, s.slug, s.cover_image_url
           FROM follows f JOIN stories s ON s.id = f.story_id
           WHERE f.user_id = ? ORDER BY f.created_at DESC LIMIT ? OFFSET ?`
        )
        .bind(userId, limit, offset)
        .all<FollowedStory>(),
      this.db.prepare("SELECT COUNT(*) as count FROM follows WHERE user_id = ?").bind(userId).first<{ count: number }>(),
    ]);
    return { items: results, total: countRow?.count ?? 0 };
  }

  async deleteForStory(storyId: number): Promise<void> {
    await this.db.prepare("DELETE FROM follows WHERE story_id = ?").bind(storyId).run();
  }
}
