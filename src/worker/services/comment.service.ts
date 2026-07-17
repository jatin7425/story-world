import type { ICommentsRepository } from "../repositories/comments.repository";
import type { IRestrictionsRepository } from "../repositories/restrictions.repository";
import type { CommentRow } from "../repositories/types";

export class CommentService {
  constructor(
    private readonly comments: ICommentsRepository,
    private readonly restrictions: IRestrictionsRepository
  ) {}

  listForChapter(chapterId: number): Promise<CommentRow[]> {
    return this.comments.listForChapter(chapterId);
  }

  async addComment(
    userId: number,
    chapterId: number,
    body: string
  ): Promise<
    { comment: Pick<CommentRow, "id" | "body" | "created_at"> } | { error: string; status: 400 | 403 }
  > {
    if (await this.restrictions.has(userId, "comment")) {
      return { error: "You've been restricted from commenting", status: 403 };
    }
    const trimmed = body.trim();
    if (!trimmed) return { error: "Comment body required", status: 400 };
    const comment = await this.comments.create(chapterId, userId, trimmed);
    return { comment };
  }
}
