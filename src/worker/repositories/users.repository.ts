import type { UserRow } from "./types";
import type { AvatarGender, Gender } from "../types";

const USER_COLUMNS =
  "id, email, display_name, role, password_hash, username, mobile, gender, avatar_gender, avatar_seed";

export interface CreatePasswordUserInput {
  email: string;
  passwordHash: string;
  username: string | null;
  mobile: string | null;
  gender: Gender | null;
  avatarGender: AvatarGender;
  avatarSeed: number;
}

export interface IUsersRepository {
  findByEmail(email: string): Promise<UserRow | null>;
  findByUsername(username: string): Promise<{ id: number } | null>;
  findById(id: number): Promise<UserRow | null>;
  findOrCreateByEmail(email: string, avatarGender: AvatarGender, avatarSeed: number): Promise<UserRow>;
  createWithPassword(input: CreatePasswordUserInput): Promise<UserRow>;
  attachPassword(userId: number, input: CreatePasswordUserInput): Promise<UserRow>;
  updateGender(userId: number, gender: Gender | null, avatarSeed: number): Promise<UserRow>;
  listAll(): Promise<UserRow[]>;
}

export class UsersRepository implements IUsersRepository {
  constructor(private readonly db: D1Database) {}

  async findByEmail(email: string): Promise<UserRow | null> {
    const row = await this.db.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE email = ?`).bind(email).first<UserRow>();
    return row ?? null;
  }

  async findByUsername(username: string): Promise<{ id: number } | null> {
    const row = await this.db.prepare("SELECT id FROM users WHERE username = ?").bind(username).first<{ id: number }>();
    return row ?? null;
  }

  async findById(id: number): Promise<UserRow | null> {
    const row = await this.db.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`).bind(id).first<UserRow>();
    return row ?? null;
  }

  async listAll(): Promise<UserRow[]> {
    const { results } = await this.db
      .prepare(`SELECT ${USER_COLUMNS} FROM users ORDER BY id DESC`)
      .all<UserRow>();
    return results;
  }

  async findOrCreateByEmail(email: string, avatarGender: AvatarGender, avatarSeed: number): Promise<UserRow> {
    const existing = await this.findByEmail(email);
    if (existing) return existing;

    const row = await this.db
      .prepare(
        `INSERT INTO users (email, avatar_gender, avatar_seed) VALUES (?, ?, ?) RETURNING ${USER_COLUMNS}`
      )
      .bind(email, avatarGender, avatarSeed)
      .first<UserRow>();
    return row!;
  }

  async createWithPassword(input: CreatePasswordUserInput): Promise<UserRow> {
    const row = await this.db
      .prepare(
        `INSERT INTO users (email, password_hash, username, mobile, gender, avatar_gender, avatar_seed)
         VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING ${USER_COLUMNS}`
      )
      .bind(
        input.email,
        input.passwordHash,
        input.username,
        input.mobile,
        input.gender,
        input.avatarGender,
        input.avatarSeed
      )
      .first<UserRow>();
    return row!;
  }

  async attachPassword(userId: number, input: CreatePasswordUserInput): Promise<UserRow> {
    const row = await this.db
      .prepare(
        `UPDATE users SET password_hash = ?, username = COALESCE(username, ?), mobile = COALESCE(mobile, ?), gender = COALESCE(gender, ?)
         WHERE id = ? RETURNING ${USER_COLUMNS}`
      )
      .bind(input.passwordHash, input.username, input.mobile, input.gender, userId)
      .first<UserRow>();
    return row!;
  }

  async updateGender(userId: number, gender: Gender | null, avatarSeed: number): Promise<UserRow> {
    const row = await this.db
      .prepare(`UPDATE users SET gender = ?, avatar_seed = ? WHERE id = ? RETURNING ${USER_COLUMNS}`)
      .bind(gender, avatarSeed, userId)
      .first<UserRow>();
    return row!;
  }
}
