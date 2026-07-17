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

export interface User {
  id: number;
  email: string;
  display_name: string | null;
  role: "reader" | "author" | "admin";
}

export interface Story {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  cover_image_url: string | null;
  free_chapter_count: number;
  created_at: string;
}

export interface ChapterSummary {
  id: number;
  chapter_number: number;
  title: string | null;
  created_at: string;
}

export interface Chapter {
  id: number;
  chapter_number: number;
  title: string | null;
  content: string;
}

export interface Comment {
  id: number;
  body: string;
  created_at: string;
  display_name: string | null;
  email: string;
}

export const api = {
  me: () => request<{ user: User | null }>("/auth/me"),
  requestLink: (email: string) =>
    request<{ ok: true }>("/auth/request-link", { method: "POST", body: JSON.stringify({ email }) }),
  logout: () => request<{ ok: true }>("/auth/logout", { method: "POST" }),

  listStories: () => request<{ stories: Story[] }>("/api/stories"),
  getStory: (slug: string) =>
    request<{
      story: Story;
      chapters: ChapterSummary[];
      followersCount: number;
      isFollowing: boolean;
      isLoggedIn: boolean;
    }>(`/api/stories/${slug}`),
  follow: (slug: string) => request<{ ok: true }>(`/api/stories/${slug}/follow`, { method: "POST" }),
  unfollow: (slug: string) => request<{ ok: true }>(`/api/stories/${slug}/follow`, { method: "DELETE" }),

  getChapter: (slug: string, number: number) =>
    request<{ chapter: Chapter; likeCount: number; likedByMe: boolean }>(
      `/api/stories/${slug}/chapters/${number}`
    ),
  like: (chapterId: number) => request<{ ok: true }>(`/api/chapters/${chapterId}/like`, { method: "POST" }),
  unlike: (chapterId: number) =>
    request<{ ok: true }>(`/api/chapters/${chapterId}/like`, { method: "DELETE" }),

  getComments: (chapterId: number) =>
    request<{ comments: Comment[] }>(`/api/chapters/${chapterId}/comments`),
  postComment: (chapterId: number, body: string) =>
    request<{ comment: Comment }>(`/api/chapters/${chapterId}/comments`, {
      method: "POST",
      body: JSON.stringify({ body }),
    }),

  getProfile: () =>
    request<{ user: User; followedStories: Story[]; recentComments: Comment[] }>("/api/profile"),

  createStory: (input: {
    title: string;
    description?: string;
    free_chapter_count?: number;
    is_ai_generated?: boolean;
    ai_generation_prompt?: string;
  }) => request<{ story: Story }>("/api/admin/stories", { method: "POST", body: JSON.stringify(input) }),
  addChapter: (storyId: number, input: { title?: string; content: string }) =>
    request<{ chapter: ChapterSummary }>(`/api/admin/stories/${storyId}/chapters`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
};
