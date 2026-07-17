export class ApiError extends Error {
  status: number;
  locked: boolean;
  constructor(message: string, status: number, locked = false) {
    super(message);
    this.status = status;
    this.locked = locked;
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...options,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const body = data as { error?: string; locked?: boolean };
    throw new ApiError(body.error ?? `Request failed: ${res.status}`, res.status, !!body.locked);
  }
  return data as T;
}

export type Gender = "male" | "female" | "other";

export interface User {
  id: number;
  email: string;
  display_name: string | null;
  role: "reader" | "author" | "admin";
  gender: Gender | null;
  avatar_url: string;
}

export interface Story {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  cover_image_url: string | null;
  free_chapter_count: number;
  status: string;
  tags: string | null;
  created_via: "admin" | "mcp";
  created_at: string;
}

export type ChapterStatus = "draft" | "published";
export type ContentSource = "admin" | "mcp" | "ai";
export type ChapterContentFormat = "markdown" | "html";

export interface ChapterSummary {
  id: number;
  chapter_number: number;
  title: string | null;
  status: ChapterStatus;
  generated_by: ContentSource;
  image_url: string | null;
  created_at: string;
}

export interface Chapter {
  id: number;
  chapter_number: number;
  title: string | null;
  content: string;
  content_format: ChapterContentFormat;
  status: ChapterStatus;
  image_url: string | null;
}

export interface AdminChapter {
  id: number;
  story_id: number;
  chapter_number: number;
  title: string | null;
  content: string;
  content_format: ChapterContentFormat;
  status: ChapterStatus;
  generated_by: ContentSource;
  image_url: string | null;
  created_at: string;
}

export interface Comment {
  id: number;
  body: string;
  created_at: string;
  display_name: string | null;
  email: string;
}

export type RestrictionType = "banned" | "comment" | "react";

export interface AdminUser {
  id: number;
  email: string;
  display_name: string | null;
  username: string | null;
  mobile: string | null;
  gender: Gender | null;
  avatar_url: string;
  role: string;
  created_at: string;
  restrictions: RestrictionType[];
}

export interface McpToken {
  id: number;
  name: string;
  created_at: string;
  last_used_at: string | null;
}

export interface StoryEditInput {
  title?: string;
  description?: string | null;
  cover_image_url?: string | null;
  free_chapter_count?: number;
  status?: string;
  tags?: string | null;
}

export interface PageMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

function qs(params: Record<string, string | number | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== "");
  if (entries.length === 0) return "";
  return "?" + entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join("&");
}

export const api = {
  me: () => request<{ user: User | null }>("/auth/me"),
  requestLink: (email: string) =>
    request<{ ok: true }>("/auth/request-link", { method: "POST", body: JSON.stringify({ email }) }),
  logout: () => request<{ ok: true }>("/auth/logout", { method: "POST" }),
  signup: (input: { email: string; password: string; username?: string; mobile?: string; gender?: Gender }) =>
    request<{ user: User }>("/auth/signup", { method: "POST", body: JSON.stringify(input) }),
  login: (email: string, password: string) =>
    request<{ user: User }>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),

  listStories: (query?: string, page?: number) =>
    request<{ stories: Story[] } & PageMeta>(`/api/stories${qs({ q: query, page })}`),
  getStory: (slug: string, chapterPage?: number) =>
    request<{
      story: Story;
      chapters: ChapterSummary[];
      chaptersTotal: number;
      chaptersPage: number;
      chaptersTotalPages: number;
      followersCount: number;
      isFollowing: boolean;
      isLoggedIn: boolean;
    }>(`/api/stories/${slug}${qs({ page: chapterPage })}`),
  follow: (slug: string) => request<{ ok: true }>(`/api/stories/${slug}/follow`, { method: "POST" }),
  unfollow: (slug: string) => request<{ ok: true }>(`/api/stories/${slug}/follow`, { method: "DELETE" }),

  getChapter: (slug: string, number: number) =>
    request<{
      chapter: Chapter;
      storyTitle: string;
      likeCount: number;
      likedByMe: boolean;
      nextChapterNumber: number | null;
    }>(`/api/stories/${slug}/chapters/${number}`),
  like: (chapterId: number) => request<{ ok: true }>(`/api/chapters/${chapterId}/like`, { method: "POST" }),
  unlike: (chapterId: number) =>
    request<{ ok: true }>(`/api/chapters/${chapterId}/like`, { method: "DELETE" }),

  getComments: (chapterId: number, page?: number) =>
    request<{ comments: Comment[] } & PageMeta>(`/api/chapters/${chapterId}/comments${qs({ page })}`),
  postComment: (chapterId: number, body: string) =>
    request<{ comment: Comment }>(`/api/chapters/${chapterId}/comments`, {
      method: "POST",
      body: JSON.stringify({ body }),
    }),

  getProfile: (followedPage?: number, commentsPage?: number) =>
    request<{
      user: User;
      followedStories: Story[];
      followedTotal: number;
      followedPage: number;
      followedTotalPages: number;
      recentComments: Comment[];
      commentsTotal: number;
      commentsPage: number;
      commentsTotalPages: number;
    }>(`/api/profile${qs({ followed_page: followedPage, comments_page: commentsPage })}`),
  updateGender: (gender: Gender | null) =>
    request<{ user: User }>("/api/profile/gender", { method: "PATCH", body: JSON.stringify({ gender }) }),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ ok: true }>("/api/profile/password", {
      method: "PATCH",
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    }),

  // --- Admin: stories/chapters ---
  adminListStories: (page?: number, limit?: number) =>
    request<{ stories: Story[] } & PageMeta>(`/api/admin/stories${qs({ page, limit })}`),
  createStory: (input: { title: string; description?: string; free_chapter_count?: number; tags?: string }) =>
    request<{ story: Story }>("/api/admin/stories", { method: "POST", body: JSON.stringify(input) }),
  updateStory: (id: number, patch: StoryEditInput) =>
    request<{ story: Story }>(`/api/admin/stories/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteStory: (id: number) => request<{ ok: true }>(`/api/admin/stories/${id}`, { method: "DELETE" }),
  getAdminStory: (id: number) => request<{ story: Story }>(`/api/admin/stories/${id}`),
  adminListChapters: (storyId: number, page?: number, limit?: number) =>
    request<{ chapters: ChapterSummary[] } & PageMeta>(`/api/admin/stories/${storyId}/chapters${qs({ page, limit })}`),
  getAdminChapter: (storyId: number, chapterNumber: number) =>
    request<{ chapter: AdminChapter }>(`/api/admin/stories/${storyId}/chapters/${chapterNumber}`),
  updateChapterContent: (
    storyId: number,
    chapterNumber: number,
    patch: {
      title?: string | null;
      content?: string;
      content_format?: ChapterContentFormat;
      image_url?: string | null;
    }
  ) =>
    request<{ chapter: AdminChapter }>(`/api/admin/stories/${storyId}/chapters/${chapterNumber}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  addChapter: (
    storyId: number,
    input: { title?: string; content: string; content_format?: ChapterContentFormat; image_url?: string }
  ) =>
    request<{ chapter: ChapterSummary }>(`/api/admin/stories/${storyId}/chapters`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  deleteChapter: (storyId: number, chapterNumber: number) =>
    request<{ ok: true }>(`/api/admin/stories/${storyId}/chapters/${chapterNumber}`, { method: "DELETE" }),
  publishChapter: (storyId: number, chapterNumber: number) =>
    request<{ chapter: ChapterSummary }>(`/api/admin/stories/${storyId}/chapters/${chapterNumber}/publish`, {
      method: "POST",
    }),
  unpublishChapter: (storyId: number, chapterNumber: number) =>
    request<{ chapter: ChapterSummary }>(`/api/admin/stories/${storyId}/chapters/${chapterNumber}/unpublish`, {
      method: "POST",
    }),

  // --- Admin: users ---
  listUsers: (page?: number, limit?: number) =>
    request<{ users: AdminUser[] } & PageMeta>(`/api/admin/users${qs({ page, limit })}`),
  banUser: (id: number) => request<{ ok: true }>(`/api/admin/users/${id}/ban`, { method: "POST" }),
  unbanUser: (id: number) => request<{ ok: true }>(`/api/admin/users/${id}/ban`, { method: "DELETE" }),
  setRestriction: (id: number, type: RestrictionType, enabled: boolean) =>
    request<{ ok: true }>(`/api/admin/users/${id}/restrictions/${type}`, {
      method: enabled ? "PUT" : "DELETE",
    }),

  // --- Admin: MCP tokens ---
  listMcpTokens: (page?: number, limit?: number) =>
    request<{ tokens: McpToken[] } & PageMeta>(`/api/admin/mcp/tokens${qs({ page, limit })}`),
  createMcpToken: (name: string) =>
    request<{ token: string; record: McpToken }>("/api/admin/mcp/tokens", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
  revokeMcpToken: (id: number) => request<{ ok: true }>(`/api/admin/mcp/tokens/${id}`, { method: "DELETE" }),
};
