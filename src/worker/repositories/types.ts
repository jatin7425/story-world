export interface StoryRow {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  cover_image_url: string | null;
  author_id: number | null;
  status: string;
  free_chapter_count: number;
  is_ai_generated: number;
  ai_generation_prompt: string | null;
  tags: string | null;
  created_via: "admin" | "mcp";
  created_at: string;
}

export type ChapterStatus = "draft" | "published";
export type ChapterContentFormat = "markdown" | "html";

export interface ChapterRow {
  id: number;
  story_id: number;
  chapter_number: number;
  title: string | null;
  content: string;
  content_format: ChapterContentFormat;
  generated_by: string;
  status: ChapterStatus;
  image_url: string | null;
  created_at: string;
}

export interface ChapterSummaryRow {
  id: number;
  chapter_number: number;
  title: string | null;
  status: ChapterStatus;
  generated_by: string;
  image_url: string | null;
  created_at: string;
}

export interface CommentRow {
  id: number;
  body: string;
  created_at: string;
  display_name: string | null;
  email: string;
}

export interface ProfileCommentRow {
  id: number;
  body: string;
  created_at: string;
  chapter_number: number;
  story_title: string;
  story_slug: string;
}

export interface McpTokenRow {
  id: number;
  name: string;
  token_hash: string;
  created_by: number | null;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

export interface UserRow {
  id: number;
  email: string;
  display_name: string | null;
  role: "reader" | "author" | "admin";
  password_hash: string | null;
  username: string | null;
  mobile: string | null;
  gender: "male" | "female" | "other" | null;
  avatar_gender: "male" | "female";
  avatar_seed: number;
  created_at: string;
}

export interface OAuthClientRow {
  client_id: string;
  client_name: string | null;
  redirect_uris: string; // JSON array, serialized
  created_at: string;
}

export interface OAuthAuthorizationCodeRow {
  code: string;
  client_id: string;
  user_id: number;
  redirect_uri: string;
  code_challenge: string;
  scope: string | null;
  expires_at: string;
  used_at: string | null;
}

export interface OAuthAccessTokenRow {
  token_hash: string;
  client_id: string;
  user_id: number;
  expires_at: string;
  created_at: string;
  last_used_at: string | null;
}

export interface OAuthRefreshTokenRow {
  token_hash: string;
  client_id: string;
  user_id: number;
  expires_at: string;
  created_at: string;
  revoked_at: string | null;
}
