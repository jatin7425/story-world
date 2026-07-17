import type { Context } from "hono";

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function toPaginated<T>(items: T[], total: number, page: number, limit: number): Paginated<T> {
  return { items, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

/** Fixed page size for every reader-facing list — customization is admin-only. */
export const READER_LIMIT = 10;

/** Reader-facing lists: always 10 per page, no client control over limit. */
export function parseReaderPagination(c: Context): { page: number; limit: number; offset: number } {
  const page = Math.max(1, Math.floor(Number(c.req.query("page")) || 1));
  const limit = READER_LIMIT;
  return { page, limit, offset: (page - 1) * limit };
}

/** Parses a named page-query param (e.g. "followed_page") at the fixed reader page size. */
export function parseReaderPage(c: Context, paramName: string): { page: number; limit: number; offset: number } {
  const page = Math.max(1, Math.floor(Number(c.req.query(paramName)) || 1));
  const limit = READER_LIMIT;
  return { page, limit, offset: (page - 1) * limit };
}

/** Admin lists: customizable limit (default 10, capped to keep queries sane). */
export function parseAdminPagination(c: Context): { page: number; limit: number; offset: number } {
  const page = Math.max(1, Math.floor(Number(c.req.query("page")) || 1));
  const requested = Math.floor(Number(c.req.query("limit")) || 10);
  const limit = Math.min(100, Math.max(1, requested || 10));
  return { page, limit, offset: (page - 1) * limit };
}
