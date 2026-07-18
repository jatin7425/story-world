export interface ImageRow {
  id: number;
  filename: string | null;
  content_type: string | null;
  data_base64: string | null;
  r2_key?: string | null;
  source_url: string | null;
  created_at: string;
}

export interface IImagesRepository {
  create(filename: string | null, contentType: string | null, dataBase64: string | null, sourceUrl: string | null): Promise<ImageRow>;
  findById(id: number): Promise<ImageRow | null>;
  list(limit: number, offset: number): Promise<{ items: ImageRow[]; total: number }>;
  delete(id: number): Promise<void>;
}

export class ImagesRepository implements IImagesRepository {
  constructor(private readonly db: D1Database, private readonly r2?: any) {}

  async create(filename: string | null, contentType: string | null, dataBase64: string | null, sourceUrl: string | null): Promise<ImageRow> {
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
