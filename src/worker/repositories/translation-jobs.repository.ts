import type {
  TranslationJobRow,
  TranslationJobItemRow,
  TranslationJobItemStatus,
  TranslationEntityType,
} from "./types";

export interface CreateJobItemInput {
  entityType: TranslationEntityType;
  entityId: number;
  entityLabel: string;
  lang: string;
}

export interface JobWithItems {
  job: TranslationJobRow;
  items: TranslationJobItemRow[];
}

export interface UpdateItemPatch {
  status?: TranslationJobItemStatus;
  providerUsed?: string | null;
  log?: string;
  errorMessage?: string | null;
}

export interface ITranslationJobsRepository {
  createJob(createdBy: number, items: CreateJobItemInput[]): Promise<JobWithItems>;
  findJob(id: number): Promise<JobWithItems | null>;
  findNextPendingItem(jobId: number): Promise<TranslationJobItemRow | null>;
  updateItem(itemId: number, patch: UpdateItemPatch): Promise<void>;
  incrementCompleted(jobId: number): Promise<void>;
  recomputeJobStatus(jobId: number): Promise<void>;
}

const JOB_ITEM_COLUMNS = "id, job_id, entity_type, entity_id, entity_label, lang, status, provider_used, log, error_message";

export class TranslationJobsRepository implements ITranslationJobsRepository {
  constructor(private readonly db: D1Database) {}

  async createJob(createdBy: number, items: CreateJobItemInput[]): Promise<JobWithItems> {
    const job = await this.db
      .prepare(
        `INSERT INTO translation_jobs (created_by, status, total_items, completed_items)
         VALUES (?, 'running', ?, 0)
         RETURNING id, created_by, status, total_items, completed_items, created_at`
      )
      .bind(createdBy, items.length)
      .first<TranslationJobRow>();

    if (items.length === 0) return { job: job!, items: [] };

    const insertStmt = this.db.prepare(
      `INSERT INTO translation_job_items (job_id, entity_type, entity_id, entity_label, lang)
       VALUES (?, ?, ?, ?, ?)`
    );
    await this.db.batch(items.map((item) => insertStmt.bind(job!.id, item.entityType, item.entityId, item.entityLabel, item.lang)));

    const { results } = await this.db
      .prepare(`SELECT ${JOB_ITEM_COLUMNS} FROM translation_job_items WHERE job_id = ? ORDER BY id ASC`)
      .bind(job!.id)
      .all<TranslationJobItemRow>();

    return { job: job!, items: results };
  }

  async findJob(id: number): Promise<JobWithItems | null> {
    const job = await this.db
      .prepare("SELECT id, created_by, status, total_items, completed_items, created_at FROM translation_jobs WHERE id = ?")
      .bind(id)
      .first<TranslationJobRow>();
    if (!job) return null;

    const { results } = await this.db
      .prepare(`SELECT ${JOB_ITEM_COLUMNS} FROM translation_job_items WHERE job_id = ? ORDER BY id ASC`)
      .bind(id)
      .all<TranslationJobItemRow>();

    return { job, items: results };
  }

  async findNextPendingItem(jobId: number): Promise<TranslationJobItemRow | null> {
    const row = await this.db
      .prepare(`SELECT ${JOB_ITEM_COLUMNS} FROM translation_job_items WHERE job_id = ? AND status = 'pending' ORDER BY id ASC LIMIT 1`)
      .bind(jobId)
      .first<TranslationJobItemRow>();
    return row ?? null;
  }

  async updateItem(itemId: number, patch: UpdateItemPatch): Promise<void> {
    const sets: string[] = [];
    const values: unknown[] = [];
    if (patch.status !== undefined) {
      sets.push("status = ?");
      values.push(patch.status);
    }
    if (patch.providerUsed !== undefined) {
      sets.push("provider_used = ?");
      values.push(patch.providerUsed);
    }
    if (patch.log !== undefined) {
      sets.push("log = ?");
      values.push(patch.log);
    }
    if (patch.errorMessage !== undefined) {
      sets.push("error_message = ?");
      values.push(patch.errorMessage);
    }
    if (sets.length === 0) return;
    values.push(itemId);
    await this.db.prepare(`UPDATE translation_job_items SET ${sets.join(", ")} WHERE id = ?`).bind(...values).run();
  }

  async incrementCompleted(jobId: number): Promise<void> {
    await this.db.prepare("UPDATE translation_jobs SET completed_items = completed_items + 1 WHERE id = ?").bind(jobId).run();
  }

  async recomputeJobStatus(jobId: number): Promise<void> {
    const counts = await this.db
      .prepare(
        `SELECT
           SUM(CASE WHEN status IN ('pending', 'running') THEN 1 ELSE 0 END) as open_count,
           SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_count
         FROM translation_job_items WHERE job_id = ?`
      )
      .bind(jobId)
      .first<{ open_count: number; failed_count: number }>();

    if (!counts || counts.open_count > 0) return; // still has pending/running items

    const status = counts.failed_count > 0 ? "failed" : "completed";
    await this.db.prepare("UPDATE translation_jobs SET status = ? WHERE id = ?").bind(status, jobId).run();
  }
}
