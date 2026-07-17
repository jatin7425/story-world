import type { IUsersRepository } from "../repositories/users.repository";
import type { IRestrictionsRepository, RestrictionType } from "../repositories/restrictions.repository";
import type { ISessionsRepository } from "../repositories/sessions.repository";
import { resolveAvatarUrl } from "../lib/avatar";
import { toPaginated, type Paginated } from "../lib/pagination";

export interface AdminUserView {
  id: number;
  email: string;
  display_name: string | null;
  username: string | null;
  mobile: string | null;
  gender: "male" | "female" | "other" | null;
  avatar_url: string;
  role: string;
  created_at: string;
  restrictions: RestrictionType[];
}

type ModerationResult = { ok: true } | { error: string };

/**
 * User moderation only — banning and privilege restrictions. Kept separate
 * from AdminStoryService: different collaborators (users/sessions/
 * restrictions vs. stories/chapters/comments/likes/follows), different
 * reason to change.
 */
export class AdminUserService {
  constructor(
    private readonly users: IUsersRepository,
    private readonly restrictions: IRestrictionsRepository,
    private readonly sessions: ISessionsRepository
  ) {}

  async listUsers(page: number, limit: number): Promise<Paginated<AdminUserView>> {
    const { items: users, total } = await this.users.listAll(limit, (page - 1) * limit);
    const restrictionsMap = await this.restrictions.listForUsers(users.map((u) => u.id));
    const views = users.map((u) => ({
      id: u.id,
      email: u.email,
      display_name: u.display_name,
      username: u.username,
      mobile: u.mobile,
      gender: u.gender,
      avatar_url: resolveAvatarUrl(u.gender, u.avatar_gender, u.avatar_seed),
      role: u.role,
      created_at: u.created_at,
      restrictions: restrictionsMap.get(u.id) ?? [],
    }));
    return toPaginated(views, total, page, limit);
  }

  async ban(userId: number): Promise<ModerationResult> {
    const target = await this.users.findById(userId);
    if (!target) return { error: "User not found" };
    if (target.role === "admin") return { error: "Cannot ban an admin account" };

    await this.restrictions.add(userId, "banned");
    // A ban should end their session immediately, not just block future logins.
    await this.sessions.deleteAllForUser(userId);
    return { ok: true };
  }

  async unban(userId: number): Promise<ModerationResult> {
    await this.restrictions.remove(userId, "banned");
    return { ok: true };
  }

  async setRestriction(userId: number, restriction: RestrictionType, enabled: boolean): Promise<ModerationResult> {
    if (restriction === "banned") return enabled ? this.ban(userId) : this.unban(userId);

    if (enabled) await this.restrictions.add(userId, restriction);
    else await this.restrictions.remove(userId, restriction);
    return { ok: true };
  }
}
