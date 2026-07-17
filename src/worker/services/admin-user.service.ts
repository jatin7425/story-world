import type { IUsersRepository } from "../repositories/users.repository";
import type { IRestrictionsRepository, RestrictionType } from "../repositories/restrictions.repository";
import type { ISessionsRepository } from "../repositories/sessions.repository";

export interface AdminUserView {
  id: number;
  email: string;
  display_name: string | null;
  username: string | null;
  role: string;
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

  async listUsers(): Promise<AdminUserView[]> {
    const users = await this.users.listAll();
    const restrictionsMap = await this.restrictions.listForUsers(users.map((u) => u.id));
    return users.map((u) => ({
      id: u.id,
      email: u.email,
      display_name: u.display_name,
      username: u.username,
      role: u.role,
      restrictions: restrictionsMap.get(u.id) ?? [],
    }));
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
