export interface ImageRow {
  id: number;
  filename: string | null;
  content_type: string | null;
  data_base64: string | null;
  r2_key?: string | null;
  source_url: string | null;
  created_at: string;
}

// D1 rejects a single column value beyond ~1MB (SQLITE_TOOBIG) — images are
// stored base64-inline (~4/3 size inflation vs. raw bytes), so cap well
// under that. Enforced here (not just in routes/admin-images.ts) so every
// caller is covered, including the MCP upload tools which call create()
// directly. A real object-storage backend (R2) would remove this ceiling.
export const MAX_IMAGE_BASE64_LENGTH = 700_000; // ~500KB raw

export interface IImagesRepository {
  create(filename: string | null, contentType: string | null, dataBase64: string | null, sourceUrl: string | null): Promise<ImageRow>;
  findById(id: number): Promise<ImageRow | null>;
  list(limit: number, offset: number): Promise<{ items: ImageRow[]; total: number }>;
  delete(id: number): Promise<void>;
}

export class ImagesRepository implements IImagesRepository {
  constructor(private readonly db: D1Database, private readonly r2?: any) {}

  async create(filename: string | null, contentType: string | null, dataBase64: string | null, sourceUrl: string | null): Promise<ImageRow> {
    if (dataBase64 && dataBase64.length > MAX_IMAGE_BASE64_LENGTH) {
      const approxMb = ((dataBase64.length * 3) / 4 / 1_000_000).toFixed(1);
      const maxMb = ((MAX_IMAGE_BASE64_LENGTH * 3) / 4 / 1_000_000).toFixed(1);
      throw new Error(`Image is ~${approxMb}MB — please use one under ${maxMb}MB.`);
    }

    const row = await this.db
      .prepare(
        `INSERT INTO images (filename, content_type, data_base64, source_url, r2_key)
         VALUES (?, ?, ?, ?, ?)
         RETURNING id, filename, content_type, data_base64, source_url, r2_key, created_at`
      )
      .bind(filename, contentType, dataBase64, sourceUrl, null)
      .first<ImageRow>();
    return row!;
  }

  async findById(id: number): Promise<ImageRow | null> {
    const row = await this.db
      .prepare(`SELECT id, filename, content_type, data_base64, source_url, r2_key, created_at FROM images WHERE id = ?`)
      .bind(id)
      .first<ImageRow>();
    return row ?? null;
  }

  async list(limit: number, offset: number): Promise<{ items: ImageRow[]; total: number }> {
    const [{ results }, countRow] = await Promise.all([
      this.db.prepare(`SELECT id, filename, content_type, data_base64, source_url, r2_key, created_at FROM images ORDER BY created_at DESC LIMIT ? OFFSET ?`).bind(limit, offset).all<ImageRow>(),
      this.db.prepare(`SELECT COUNT(*) as count FROM images`).first<{ count: number }>(),
    ]);
    return { items: results, total: countRow?.count ?? 0 };
  }

  async delete(id: number): Promise<void> {
    await this.db.prepare(`DELETE FROM images WHERE id = ?`).bind(id).run();
  }
}
