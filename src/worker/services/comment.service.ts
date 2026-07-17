import type { ICommentsRepository } from "../repositories/comments.repository";
import type { IRestrictionsRepository } from "../repositories/restrictions.repository";
import type { CommentRow } from "../repositories/types";
import { toPaginated, type Paginated } from "../lib/pagination";

export class CommentService {
  constructor(
    private readonly comments: ICommentsRepository,
    private readonly restrictions: IRestrictionsRepository
  ) {}

  async listForChapter(chapterId: number, page: number, limit: number): Promise<Paginated<CommentRow>> {
    const { items, total } = await this.comments.listForChapter(chapterId, limit, (page - 1) * limit);
    return toPaginated(items, total, page, limit);
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
